import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AVATARS,DEFAULT_TEAM_AVATARS,move,neutralInput,rayPlayer,eyePosition,validInput,type Motion,type Solid} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {DeadBodies,visibleMinimumY} from '../apps/web/components/dead-bodies';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {resetAvatarMotion,animateAvatarMotion} from '../apps/web/components/avatar-motion';
import {Spectator,spectatorPose} from '../apps/web/components/spectator';
import {Client,type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import type {Snapshot} from '@sirocco/shared';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ControlsDialog} from '../apps/web/components/ControlsDialog';

test('only More fun rooms allow play-dead input, in either game mode and after a reset',()=>{
 for(const mode of ['deathmatch','defusal'] as const)for(const moreFun of [false,true]){
  const sim=new Simulation([],mode,DEFAULT_TEAM_AVATARS,moreFun),p=sim.add('p','P');
  for(let round=0;round<2;round++){
   Object.assign(p,{x:0,y:0,z:0,grounded:true});sim.input(p.id,{...neutralInput(),seq:p.ack+1,playDead:true});sim.step();
   assert.equal(!!p.playingDead,moreFun);assert.equal(sim.snapshot().moreFun??true,moreFun);
   sim.input(p.id,{...neutralInput(),seq:p.ack+1,playDead:false,crouch:true});sim.step();assert.equal(p.playingDead,undefined);assert.equal(p.crouched,true);
   sim.finish();sim.rematch();
  }
 }
});

test('Classic controls hide play dead and keep Ctrl crouch visible',()=>{
 for(const moreFun of [false,true]){const html=renderToStaticMarkup(createElement(ControlsDialog,{open:false,onClose:()=>{},defusal:true,hasLadders:true,spectating:false,moreFun}));assert.equal(html.includes('Play dead / get up'),moreFun);assert.ok(html.includes('CTRL'));assert.ok(html.includes('Crouch (hold)'));}
});

test('playing dead stays alive, stationary and vulnerable; actions pause and getting up restores control',()=>{
 const sim=new Simulation([]),p=sim.add('p','P'),enemy=sim.add('e','E');Object.assign(p,{x:0,y:0,z:0,protectedUntil:0,reloadUntil:3000});p.ammo.rifle=12;
 sim.input(p.id,{...neutralInput(),seq:1,playDead:true,forward:1,fire:true});sim.step();
 assert.ok(p.playingDead);assert.equal(p.playingDead.at,sim.time);assert.equal(p.reloadUntil,0);assert.equal(p.hp,100);assert.equal(p.deaths,0);assert.equal(p.respawnAt,0);assert.equal(p.death,undefined);
 const at={x:p.x,y:p.y,z:p.z},yaw=p.playingDead.yaw,grenades=p.grenades;
 for(let seq=2;seq<100;seq++){sim.input(p.id,{...neutralInput(),seq,playDead:true,forward:1,strafe:1,jump:true,sprint:true,fire:true,reload:true,interact:true,spray:true,dog:true,summon:true,weapon:'grenade',yaw:1,pitch:.5});sim.step();}
 assert.deepEqual({x:p.x,y:p.y,z:p.z},at);assert.equal(p.yaw,1);assert.equal(p.playingDead!.yaw,yaw);assert.equal(p.ammo.rifle,12);assert.equal(p.grenades,grenades);assert.equal(sim.dogs.length+sim.trexes.length+sim.sprays.length,0);assert.equal(p.weapon,'rifle');
 const snapshot=sim.snapshot();snapshot.players.find(q=>q.id===p.id)!.playingDead!.yaw=999;assert.equal(p.playingDead!.yaw,yaw);
 sim.damage(p,20,enemy,'rifle',enemy);assert.equal(p.hp,90,'feigning grants no invulnerability');
 sim.input(p.id,{...neutralInput(),seq:100,playDead:false,crouch:true});sim.step();assert.equal(p.playingDead,undefined);assert.equal(p.crouched,true,'Ctrl remains crouch');
 sim.input(p.id,{...neutralInput(),seq:101,forward:1});sim.step();assert.ok(p.z<0);assert.equal(p.crouched,false);
 sim.input(p.id,{...neutralInput(),seq:102,playDead:true});sim.step();assert.ok(p.playingDead);sim.spawn(p);assert.equal(p.playingDead,undefined);
 assert.equal(validInput({...neutralInput(),playDead:'yes'}),false);assert.equal(validInput({...neutralInput(),playDead:true}),true);
});

test('lying down needs supported space, cannot start in air or on ladders, and cannot stand through ceilings',()=>{
 const p:Motion={x:0,y:0,z:0,vy:0,grounded:true};
 assert.equal(move({...p,grounded:false},{...neutralInput(),playDead:true},[]).playingDead,undefined);
 assert.equal(move({...p,climbing:'ladder'},{...neutralInput(),playDead:true},[]).playingDead,undefined);
 const wall:Solid={kind:'wall',x:0,y:1,z:1,w:3,h:2,d:.3};
 const prone=move(p,{...neutralInput(),playDead:true},[wall]);assert.ok(prone.playingDead);assert.notEqual(prone.playingDead.yaw,0,'turn to free space instead of lying through the wall');
 const roof:Solid={kind:'roof',x:0,y:1.4,z:0,w:6,h:.2,d:6};
 const under=move(p,{...neutralInput(),playDead:true},[roof]);assert.ok(under.playingDead);
 assert.ok(move(under,{...neutralInput(),playDead:false},[roof]).playingDead,'standing height is obstructed');
 const crouched=move(under,{...neutralInput(),playDead:false,crouch:true},[roof]);assert.equal(crouched.playingDead,undefined);assert.equal(crouched.crouched,true);
 const box:Solid={kind:'crate',x:0,y:.6,z:0,w:5,h:1.2,d:5};assert.ok(move({...p,y:1.2},{...neutralInput(),playDead:true},[box]).playingDead,'large boxes support the whole body');
 assert.equal(move({...p,y:8},{...neutralInput(),playDead:true},[]).playingDead,undefined,'no supported surface in midair');
});

test('prone body and lethal head hitboxes follow the visible horizontal orientation and eye position',()=>{
 for(const yaw of [0,.8,Math.PI/2,Math.PI]){
  const p:Motion={x:0,y:0,z:0,vy:0,grounded:true,playingDead:{at:1,yaw}};
  const head=eyePosition(p),origin={x:head.x+Math.sin(yaw)*3,y:head.y,z:head.z+Math.cos(yaw)*3},direction={x:-Math.sin(yaw),y:0,z:-Math.cos(yaw)};
  assert.equal(rayPlayer(origin,direction,p)?.zone,'head');assert.equal(rayPlayer({...origin,y:1.6},direction,p),null,'standing head-height shots pass over a prone player');
  assert.equal(rayPlayer({x:Math.sin(yaw)*.8,y:3,z:Math.cos(yaw)*.8},{x:0,y:-1,z:0},p)?.zone,'body');
 }
 const sim=new Simulation([],'defusal'),p=sim.add('p','P'),enemy=sim.add('e','E');Object.assign(p,{x:0,y:0,z:0,playingDead:{at:1,yaw:0},protectedUntil:0});
 assert.equal(new Spectator().candidates(sim.snapshot(),p.id).length,0,'a feigned death never enables spectator mode');
 assert.equal(spectatorPose(p,p,.5).y,.42);sim.damage(p,1,enemy,'pistol',enemy,'head');assert.equal(p.hp,0,'headshots remain lethal');sim.finish();sim.rematch();assert.equal(p.playingDead,undefined);
});

test('all characters lie on the actual floor, retain the pose when killed and get up with their equipment',()=>{
 const before=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{for(const avatar of AVATARS){const sim=new Simulation([]),p=sim.add('p','P');Object.assign(p,{avatar:avatar.id,x:0,y:0,z:0,playingDead:{at:1,yaw:.8}});const model=buildAvatar(art,p.avatar);equipAvatarModel(art,model,'rifle',p.avatar);const bodies=new DeadBodies();bodies.pose(model,p,1001,[]);assert.ok(visibleMinimumY(model)>.005);assert.ok(Math.abs(model.up.clone().applyQuaternion(model.quaternion).y)<.001);assert.equal(model.getObjectByName('equipmentBody')!.visible,false);const at=model.position.clone(),rotation=model.quaternion.clone();Object.assign(p,{hp:0,death:{at:1200,from:{x:3,y:0,z:0},vy:0,crouched:false}});bodies.pose(model,p,1500,[]);assert.ok(at.equals(model.position)&&rotation.equals(model.quaternion),'actual death must not pop a lying player upright');bodies.remove(p.id);resetAvatarMotion(model);model.position.set(0,0,0);model.rotation.set(0,0,0);animateAvatarMotion(model,'rifle',{reload:0,plant:0,throwProgress:0,slash:1},1/60,true);assert.equal(model.getObjectByName('equipmentBody')!.visible,true);disposeGroup(model);}}finally{art.destroy();globalThis.document=before;THREE.TextureLoader.prototype.load=load;}
});

test('other clients see a living player lie down and get up in the same bomb round',{timeout:12000},async()=>{
 const server=await createGameServer({secret:'play-dead-test-secret-at-least-thirty-two-characters'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();let invite='';
 const until=async(fn:()=>boolean)=>{const at=Date.now();while(!fn()){assert.ok(Date.now()-at<5000,'shared play-dead state arrived');await new Promise(r=>setTimeout(r,20));}};
 try{
  for(let i=0;i<2;i++){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Feign '+i,invite:invite||undefined,mapId:'dunes',mode:'defusal'})});const data=await response.json();assert.equal(response.status,200);invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));rooms.push(room);}
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.length===2));const [actor,observer]=rooms,match=states.get(actor.sessionId)!.matchId;
  actor.send('input',{...neutralInput(),seq:1,playDead:true});await until(()=>!!states.get(observer.sessionId)?.players.find(p=>p.id===actor.sessionId)?.playingDead);
  const seen=states.get(observer.sessionId)!.players.find(p=>p.id===actor.sessionId)!;assert.equal(seen.hp,100);assert.equal(seen.deaths,0);assert.equal(seen.death,undefined);assert.equal(states.get(observer.sessionId)!.phase,'playing');
  actor.send('input',{...neutralInput(),seq:2,playDead:false});await until(()=>states.get(observer.sessionId)?.players.find(p=>p.id===actor.sessionId)?.ack===2);assert.equal(states.get(observer.sessionId)!.players.find(p=>p.id===actor.sessionId)!.playingDead,undefined);assert.equal(states.get(observer.sessionId)!.matchId,match);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
