import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {DT,MAPS,neutralInput,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('a large sequence gap resumes immediately without replaying stale actions or granting extra movement',()=>{
 const s=new Simulation([]),p=s.add('p','Player');Object.assign(p,{x:0,y:0,z:0});
 for(let seq=1;seq<=8;seq++)s.input(p.id,{...neutralInput(),seq,fire:true});
 assert.equal(s.input(p.id,{...neutralInput(),seq:500,forward:1}),true);assert.equal(s.queues.get(p.id)!.length,1);s.step();assert.equal(p.ack,500);assert.equal(p.ammo.rifle,30,'queued shots from before the stall are discarded');assert.ok(Math.abs(p.z)<=5.5*DT+.0001);
 const z=p.z;for(const seq of [499,500,NaN,Infinity,2**31])s.input(p.id,{...neutralInput(),seq,forward:1});s.step();assert.equal(p.z,z);assert.equal(p.ack,500);
 s.input(p.id,{...neutralInput(),seq:501,forward:1});s.step();assert.equal(p.ack,501);assert.ok(p.z<z,'normal controls continue in the same life');
});

test('six cave players recover in the same room after a rate-limited burst and a long input gap',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'cave-lag-recovery-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();let invite='';
 const until=async(fn:()=>boolean)=>{const start=Date.now();while(!fn()){assert.ok(Date.now()-start<5000,'room recovered');await new Promise(r=>setTimeout(r,20));}};
 try{
  for(let i=0;i<6;i++){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Recovery '+i,mapId:'caverns',mode:'defusal',moreFun:false,invite:invite||undefined})}),data=await response.json();assert.equal(response.status,200);invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));rooms.push(room);}
  const sim=activeRooms.get(rooms[0].roomId)!.sim,match=sim.matchId;
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.length===6));
  for(const room of rooms)for(let seq=1;seq<=150;seq++)room.send('input',{...neutralInput(),seq});
  await new Promise(r=>setTimeout(r,1200));
  const before=new Map([...sim.players].map(([id,p])=>[id,{x:p.x,z:p.z}])),at=sim.time;
  for(const room of rooms)room.send('input',{...neutralInput(),seq:500,spawnId:sim.players.get(room.sessionId)!.spawnId,forward:1});
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.find(p=>p.id===r.sessionId)?.ack===500));
  for(const room of rooms){const p=sim.players.get(room.sessionId)!,old=before.get(p.id)!;assert.equal(room.roomId,rooms[0].roomId);assert.equal(states.get(room.sessionId)!.matchId,match);assert.ok(Math.hypot(p.x-old.x,p.z-old.z)<=5.5*(sim.time-at)/1000+.001);assert.equal(p.ammo.rifle,30);assert.equal(p.grenades,2);room.send('input',{...neutralInput(),seq:501,spawnId:p.spawnId,forward:1});}
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.find(p=>p.id===r.sessionId)?.ack===501));
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
