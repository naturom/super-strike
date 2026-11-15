import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {neutralInput,type Snapshot,type CombatEvent} from '@sirocco/shared';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
test('all clients see a dog only after deployment, its HP updates, and reconnect keeps the one-use charge',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'dog-network-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>(),events:CombatEvent[]=[];let invite='';
 const until=async(fn:()=>boolean)=>{const at=Date.now();while(!fn()){assert.ok(Date.now()-at<4000,'dog state arrived');await new Promise(r=>setTimeout(r,20));}};
 function attach(room:Room){rooms.push(room);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));room.onMessage('combat',(e:CombatEvent)=>events.push(e));}
 async function join(name:string){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined,mapId:'relay',moreFun:true})}),data=await response.json();invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);attach(room);await until(()=>states.has(room.sessionId));return room;}
 try{
  const owner=await join('Owner'),enemy=await join('Enemy'),sim=activeRooms.get(owner.roomId)!.sim,p=sim.players.get(owner.sessionId)!,q=sim.players.get(enemy.sessionId)!;sim.solids=[];Object.assign(p,{x:0,y:0,z:10,yaw:0});Object.assign(q,{x:0,y:0,z:-10,protectedUntil:1e9});
  assert.equal(states.get(enemy.sessionId)!.dogs,undefined);owner.send('input',{...neutralInput(),seq:1,dog:true});await until(()=>states.get(enemy.sessionId)?.dogs?.length===1);const id=sim.dogs[0].id;
  assert.equal(states.get(enemy.sessionId)!.dogs![0].hp,35);assert.ok(events.some(e=>e.type==='dogDeploy'));
  const late=await join('Late ally');assert.equal(states.get(late.sessionId)!.dogs![0].id,id);owner.send('input',{...neutralInput(),seq:2,dog:true});await until(()=>p.ack===2);assert.equal(sim.dogs.length,1);
  sim.damageDog(sim.dogs[0],10,q,'pistol',q);await until(()=>states.get(late.sessionId)?.dogs?.[0].hp===25);
  const token=owner.reconnectionToken;owner.connection.close();await until(()=>!p.connected);const restored=await new Client(base.replace('http:','ws:')).reconnect(token);attach(restored);await until(()=>p.connected&&states.get(restored.sessionId)?.players.some(v=>v.id===p.id&&v.dogUsed===true)===true);
  restored.send('input',{...neutralInput(),seq:3,dog:true});await until(()=>p.ack===3);assert.equal(sim.dogs.length,1);
  const target=sim.dogs[0],dx=target.x-q.x,dz=target.z-q.z;enemy.send('input',{...neutralInput(),seq:1,fire:true,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(target.y+.43-(q.y+1.6),Math.hypot(dx,dz))});await until(()=>states.get(enemy.sessionId)?.dogs?.[0].hp===0);assert.ok(events.some(e=>e.type==='dogDeath'));assert.equal(sim.dogs[0].state,'dead');
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
