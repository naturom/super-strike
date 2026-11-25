import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {DEFAULT_TEAM_AVATARS,KNIFE,PLAYER_HEALTH,neutralInput,type Snapshot,type CombatEvent} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('knife hits the visible horizontal body and head when playing dead, without gun headshot damage',()=>{
 for(const part of ['body','head'] as const)for(const yaw of [0,.8,Math.PI/2]){
  const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B');s.time=2000;
  Object.assign(b,{x:0,y:0,z:0,playingDead:{at:1000,yaw},protectedUntil:0});
  const along=part==='head'?1.65:.85,target={x:Math.sin(yaw)*along,y:part==='head'?.42:.3,z:Math.cos(yaw)*along};
  const x=target.x+Math.cos(yaw)*.7,z=target.z-Math.sin(yaw)*.7,dx=target.x-x,dz=target.z-z;
  Object.assign(a,{x,y:0,z,weapon:'knife',yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(target.y-1.6,Math.hypot(dx,dz)),protectedUntil:0});
  s.input(a.id,{...neutralInput(),seq:1,weapon:'knife',yaw:a.yaw,pitch:a.pitch,fire:true});s.step();
  assert.equal(b.hp,100-KNIFE.damage*PLAYER_HEALTH.damageScale,`${part} at yaw ${yaw}`);assert.equal(s.events.find(e=>e.type==='melee')?.target,b.id);assert.equal(s.events.find(e=>e.type==='damage')?.weapon,'knife');
 }
});

test('real opponents receive knife damage and a knife kill after five distinct close-range clicks',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'knife-damage-network-test-at-least-thirty-two-characters'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>(),events:CombatEvent[]=[];let invite='';
 const until=async(fn:()=>boolean,label:string)=>{const at=Date.now();while(!fn()){assert.ok(Date.now()-at<5000,label);await new Promise(r=>setTimeout(r,20));}};
 try{
  for(let i=0;i<2;i++){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Knife '+i,invite:invite||undefined,mapId:'relay',mode:'deathmatch',moreFun:false})}),data=await r.json();assert.equal(r.status,200);invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);rooms.push(room);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));room.onMessage('combat',(e:CombatEvent)=>events.push(e));}
  const [attacker,victim]=rooms;await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.length===2),'both players ready');const sim=activeRooms.get(attacker.roomId)!.sim;sim.solids=[];
  const a=sim.players.get(attacker.sessionId)!,b=sim.players.get(victim.sessionId)!;Object.assign(a,{x:0,y:0,z:0,yaw:0,pitch:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-1.4,protectedUntil:0});
  let seq=0;
  for(const hp of [80,60,40,20,0]){
   attacker.send('input',{...neutralInput(),seq:++seq,spawnId:a.spawnId,weapon:'knife',fire:false});await new Promise(r=>setTimeout(r,KNIFE.interval+50));
   attacker.send('input',{...neutralInput(),seq:++seq,spawnId:a.spawnId,weapon:'knife',fire:true});
   await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.find(p=>p.id===victim.sessionId)?.hp===hp),`both players observe ${hp} HP`);
  }
  const kill=events.find(e=>e.type==='kill'&&e.shooter===attacker.sessionId&&e.target===victim.sessionId);assert.equal(kill?.weapon,'knife');assert.equal(a.kills,1);assert.equal(b.deaths,1);assert.equal(a.ammo.rifle,30);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
