import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Client,type Room} from '@colyseus/sdk';
import {MAPS,WEAPONS,groundAt,intersects,neutralInput,type Snapshot,type Pickup} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {GroundWeapons} from '../apps/web/components/ground-weapons';
import {WorldArt,disposeGroup} from '../apps/web/components/world';

function die(s:Simulation,id:string){const p=s.players.get(id)!;p.protectedUntil=0;s.damage(p,200,p,p.weapon,p);}
test('swapped guns clear the entire display stand at every rack and facing, including the barrel',()=>{
 const before=globalThis.document,ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];const model=art.weapon('marksman',false);model.rotation.z=Math.PI/2;const lift=-new THREE.Box3().setFromObject(model).min.y*.8+.025;model.scale.setScalar(.8);
 try{for(const mapId of ['dunes','relay'] as const)for(const rack of MAPS[mapId].pickups)for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const s=new Simulation(mapId,'deathmatch',undefined,false),p=s.add('a','A');Object.assign(p,{x:rack.x,y:rack.y,z:rack.z,yaw,primary:'marksman',weapon:'marksman'});p.ammo.marksman=4;p.ammo.pistol=4;s.pickup(p);const gun=s.pickups.find(g=>g.dropped)!;assert.ok(gun,`${mapId} ${rack.id}: old gun retained`);assert.equal(gun.ammo,4);
  model.position.set(gun.x,gun.y+lift,gun.z);model.rotation.set(0,gun.yaw??0,Math.PI/2);const bounds=new THREE.Box3().setFromObject(model);
  for(const stand of MAPS[mapId].pickups){const pedestal=new THREE.Box3(new THREE.Vector3(stand.x-.625,stand.y-(mapId==='relay'?.16:0),stand.z-.375),new THREE.Vector3(stand.x+.625,stand.y+(mapId==='dunes'?.22:0),stand.z+.375)).expandByScalar(.015);assert.equal(bounds.intersectsBox(pedestal),false,`${mapId} ${rack.id} yaw ${yaw}: gun intersects ${stand.id}`);}
 }}finally{disposeGroup(model);art.destroy();globalThis.document=before;}
});
test('death drops both guns with remaining magazines, and respawning does not remove them',()=>{
 const s=new Simulation('relay','deathmatch',undefined,false),p=s.add('a','A');p.primary=p.weapon='marksman';p.secondary='deagle';p.ammo.marksman=3;p.ammo.deagle=5;die(s,p.id);
 const dropped=s.pickups.filter(p=>p.dropped);assert.equal(dropped.length,2);assert.deepEqual(dropped.map(p=>[p.weapon,p.ammo]),[['marksman',3],['deagle',5]]);
 for(const gun of dropped){assert.equal(gun.y,groundAt(gun,s.solids));assert.equal(s.solids.some(b=>intersects(gun,b,.18,.15)),false);}
 s.damage(p,200,p,'rifle',p);assert.equal(s.pickups.filter(p=>p.dropped).length,2,'a corpse cannot duplicate drops');for(let i=0;i<160;i++)s.step();assert.equal(p.hp,100);assert.ok(dropped.every(g=>s.pickups.some(p=>p.id===g.id)));
 const copy=s.snapshot();copy.pickups.find(g=>g.id===dropped[0].id)!.ammo=99;assert.equal(dropped[0].ammo,3);
});
test('a fully blocked stand still keeps the dropped gun above its top instead of inside it',()=>{
 const s=new Simulation('dunes','deathmatch',undefined,false),p=s.add('a','A'),rack=s.pickups[0];Object.assign(p,{x:rack.x,y:rack.y,z:rack.z,yaw:0});s.solids=[{x:p.x,y:p.y-.1,z:p.z,w:8,h:.2,d:8,kind:'floor'},...[-1,1].flatMap(side=>[{x:p.x+side*.72,y:p.y+1,z:p.z,w:.1,h:2,d:4,kind:'wall' as const},{x:p.x,y:p.y+1,z:p.z+side*.52,w:4,h:2,d:.1,kind:'wall' as const}])];s.pickup(p);const gun=s.pickups.find(g=>g.dropped)!;assert.equal(gun.x,p.x);assert.equal(gun.z,p.z);assert.ok(Math.abs(gun.y-rack.y-.22)<1e-6);
});
test('weapon swaps leave the old gun on the floor and either team can pick it up without restocking it',()=>{
 const s=new Simulation('relay','deathmatch',undefined,false),a=s.add('a','A'),b=s.add('b','B');a.ammo.rifle=7;
 const rack=s.pickups.find(p=>p.weapon==='m4a1s')!;Object.assign(a,{x:rack.x,y:rack.y,z:rack.z});s.pickup(a);assert.equal(a.primary,'m4a1s');assert.equal(a.ammo.m4a1s,WEAPONS.m4a1s.magazine);const old=s.pickups.find(p=>p.dropped)!;assert.equal(old.weapon,'rifle');assert.equal(old.ammo,7);
 Object.assign(b,{x:old.x,y:old.y,z:old.z});b.primary='ak47';b.ammo.ak47=9;s.pickup(b);assert.equal(b.primary,'rifle');assert.equal(b.ammo.rifle,7);assert.equal(s.pickups.some(p=>p.id===old.id),false);const swapped=s.pickups.find(p=>p.dropped&&p.weapon==='ak47')!;assert.equal(swapped.ammo,9);
 s.time+=25000;s.step();assert.equal(s.pickups.some(p=>p.id===old.id),false,'consumed ground guns do not respawn');assert.ok(s.pickups.some(p=>p.id===swapped.id),'unclaimed guns remain until round reset');
});
test('dropped sidearms replace only the sidearm, and round/map resets clear all ground guns',()=>{
 const s=new Simulation('relay','deathmatch',undefined,false),a=s.add('a','A'),b=s.add('b','B');a.secondary='deagle';a.ammo.deagle=0;die(s,a.id);const pistol=s.pickups.find(p=>p.dropped&&p.weapon==='deagle')!;Object.assign(b,{x:pistol.x,y:pistol.y,z:pistol.z});b.primary='scar';b.ammo.scar=12;s.pickup(b);assert.equal(b.secondary,'deagle');assert.equal(b.ammo.deagle,0);assert.equal(b.primary,'scar');assert.equal(b.ammo.scar,12);
 s.finish();s.rematch();assert.equal(s.pickups.some(p=>p.dropped),false);assert.equal(s.pickups.length,MAPS.relay.pickups.length);die(s,b.id);assert.ok(s.pickups.some(p=>p.dropped));assert.equal(s.changeMap('caverns').pickups.some(p=>p.dropped),false);
});
test('a tested flower gun remains harmless when dropped and collected, without exposing unrevealed secrets',()=>{
 const s=new Simulation('relay'),a=s.add('a','A'),b=s.add('b','B');s.solids=[];let flower:Pickup|undefined;
 for(const rack of [...s.pickups].filter(p=>p.base==='red')){Object.assign(a,{x:rack.x,y:rack.y,z:rack.z});s.pickup(a);s.events=[];s.fire(a);if(s.events.some(e=>e.type==='flower')){die(s,a.id);flower=s.pickups.find(p=>p.dropped&&p.weapon===rack.weapon);break;}}
 assert.ok(flower);assert.equal('flower' in flower,false);Object.assign(b,{x:flower.x,y:flower.y,z:flower.z});s.pickup(b);const before=b.ammo[b.primary];s.events=[];s.fire(b);assert.equal(b.ammo[b.primary],before);assert.ok(b.flowerWeapons?.includes(b.primary));assert.equal(s.events.some(e=>e.type==='shot'),false);
});
test('ground weapon instances sit on their supporting floor and share draw calls as their count grows',()=>{
 const before=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];const scene=new THREE.Scene(),models=new GroundWeapons(art,scene);
 try{const guns:Pickup[]=Array.from({length:24},(_,i)=>({id:`ground-${i}`,weapon:'m4a1s',x:i*2,y:i%3,z:0,yaw:i*.3,dropped:true,ammo:3,availableAt:0}));models.sync(guns.slice(0,1));const draws=models.root.children.length;assert.ok(draws>0&&draws<20);const first=models.root.children[0];models.sync(guns.slice(0,1));assert.equal(models.root.children[0],first,'movement snapshots reuse the same batch');models.sync(guns);assert.equal(models.root.children.length,draws);
  const matrix=new THREE.Matrix4();let floor=Infinity;models.root.traverse(o=>{if(!(o instanceof THREE.InstancedMesh))return;assert.equal(o.count,24);for(let i=0;i<24;i++){o.getMatrixAt(i,matrix);o.geometry.computeBoundingBox();floor=Math.min(floor,o.geometry.boundingBox!.clone().applyMatrix4(matrix).min.y-guns[i].y);}});assert.ok(Math.abs(floor-.025)<1e-5,'guns rest on the ground instead of floating');models.sync([]);assert.equal(models.root.children.length,0);
 }finally{models.destroy();art.destroy();globalThis.document=before;THREE.TextureLoader.prototype.load=load;}
});
test('other players and late joiners see the same dropped gun, and its pickup removes it for everyone',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'dropped-guns-network-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();let invite='';const until=async(fn:()=>boolean)=>{const at=Date.now();while(!fn()){assert.ok(Date.now()-at<5000,'shared ground-gun update');await new Promise(r=>setTimeout(r,20));}};
 async function join(name:string){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapId:'relay',mode:'deathmatch',moreFun:false,nickname:name,invite:invite||undefined})}),data=await response.json();assert.equal(response.status,200);invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);rooms.push(room);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));await until(()=>states.has(room.sessionId));return room;}
 try{const a=await join('Dropper'),b=await join('Collector'),s=activeRooms.get(a.roomId)!.sim,p=s.players.get(a.sessionId)!;p.primary=p.weapon='marksman';p.ammo.marksman=2;die(s,p.id);await until(()=>!!states.get(b.sessionId)?.pickups.some(p=>p.dropped&&p.weapon==='marksman'));const gun=s.pickups.find(p=>p.dropped&&p.weapon==='marksman')!;const c=await join('Late collector');assert.ok(states.get(c.sessionId)!.pickups.some(p=>p.id===gun.id));const other=s.players.get(b.sessionId)!;Object.assign(other,{x:gun.x,y:gun.y,z:gun.z});b.send('input',{...neutralInput(),seq:1,spawnId:other.spawnId,interact:true});await until(()=>rooms.every(r=>!states.get(r.sessionId)?.pickups.some(p=>p.id===gun.id)));assert.equal(other.primary,'marksman');assert.equal(other.ammo.marksman,2);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
