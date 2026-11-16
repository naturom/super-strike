import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {MAPS,DEFAULT_TEAM_AVATARS,ROUND_MS,SurfaceCache,neutralInput,type Snapshot,type SnapshotUpdate,type SurfaceUpdate} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('map switches start a clean game while preserving teams, identities, settings, and input sequence continuity',()=>{
 for(const mode of ['deathmatch','defusal'] as const){
  const sim=new Simulation('dunes',mode,{red:'ultraman',blue:'ironman'},false),a=sim.add('a','A'),b=sim.add('b','B'),c=sim.add('c','C');sim.remove(a.id);sim.time=12000;
  for(const player of [b,c]){player.hp=0;player.kills=3;player.deaths=2;player.dogUsed=true;player.weapon='knife';player.grenades=0;player.flowerWeapons=['rifle'];player.untestedWeapons=['pistol'];player.grenadeThrow={startedAt:11000,released:false};player.reloadUntil=13000;sim.input(player.id,{...neutralInput(),seq:100});}
  c.connected=false;sim.phase='finished';sim.winner='red';sim.scores.red=8;
  const next=sim.changeMap('relay');assert.notEqual(next,sim);assert.notEqual(next.matchId,sim.matchId);assert.equal(next.round,sim.round+1);assert.equal(next.mapId,'relay');assert.equal(next.mode,mode);assert.equal(next.moreFun,false);assert.deepEqual(next.teamAvatars,sim.teamAvatars);assert.equal(next.time,12000);assert.equal(next.phase,'playing');assert.equal(next.winner,null);assert.deepEqual(next.scores,{red:0,blue:0});assert.equal(next.endsAt,mode==='defusal'?0:12000+ROUND_MS);
  for(const old of [b,c]){const player=next.players.get(old.id)!;assert.equal(player.team,old.team);assert.equal(player.name,old.name);assert.equal(player.connected,old.connected);assert.equal(player.avatar,next.teamAvatars[player.team]);assert.equal(player.hp,100);assert.equal(player.spawnId,old.spawnId+1);assert.equal(player.ack,100);assert.equal(player.weapon,'rifle');assert.equal(player.primary,'rifle');assert.equal(player.grenades,2);assert.equal(player.kills,0);assert.equal(player.deaths,0);assert.equal(player.reloadUntil,0);assert.equal(player.grenadeThrow,undefined);assert.equal(player.flowerWeapons,undefined);assert.equal(player.untestedWeapons,undefined);assert.equal(player.dogUsed,undefined);assert.ok(MAPS.relay.spawns[player.team].some(s=>s.x===player.x&&s.y===player.y&&s.z===player.z));}
  assert.equal(next.grenades.length,0);assert.equal(next.sprays.length,0);assert.equal(next.impacts.length,0);assert.equal(next.trexes.length,0);assert.equal(next.dogs.length,0);assert.equal(next.pickups.length,MAPS.relay.pickups.length);
  const player=next.players.get(b.id)!;next.input(b.id,{...neutralInput(),seq:101,spawnId:b.spawnId,weapon:'knife'});next.step();assert.equal(player.weapon,'rifle','old-map inputs cannot equip weapons after the reset');next.input(b.id,{...neutralInput(),seq:102,spawnId:player.spawnId,weapon:'pistol'});next.step();assert.equal(player.weapon,'pistol');assert.equal(player.ack,102);assert.equal(next.changeMap('relay'),next,'current map is a harmless no-op');
  if(mode==='defusal'){assert.equal(next.bombs.length,2);for(const bomb of next.bombs){assert.equal(bomb.explodeAt,0);assert.equal(bomb.action,null);assert.equal(bomb.carrierId,bomb.team===player.team?player.id:null);}}
 }
});

test('only the host can switch the room while preserving its link, late joins and reconnects',{timeout:20000},async()=>{
 const server=await createGameServer({secret:'map-switch-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,ws=base.replace('http:','ws:'),rooms:Room[]=[],states=new Map<string,Snapshot>(),notices:any[]=[],errors:string[]=[];let invite='';
 const post=async(body:unknown)=>{const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const until=async(check:()=>boolean,label:string)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<5000,label);await new Promise(r=>setTimeout(r,20));}};
 function attach(room:Room){rooms.push(room);room.reconnection.enabled=false;const cache=new SurfaceCache();room.onMessage('surfaceUpdates',(update:SurfaceUpdate)=>cache.apply(update));room.onMessage('snapshot',(update:SnapshotUpdate)=>states.set(room.sessionId,cache.merge(update)));room.onMessage('combat',()=>{});room.onMessage('mapChanged',data=>notices.push(data));room.onMessage('mapChangeError',(data:any)=>errors.push(data.message));room.send('surfaceUpdates',1);}
 async function join(name:string){const {status,data}=await post({nickname:name,invite:invite||undefined,mapId:'dunes',mode:'defusal',moreFun:false});assert.equal(status,200);if(!invite)invite=data.invite;assert.equal(data.invite,invite);const room=await new Client(ws).consumeSeatReservation(data.reservation);attach(room);await until(()=>states.has(room.sessionId),'first snapshot');return {room,data};}
 try{
  const {room:creator}=await join('Creator'),{room:guest}=await join('Guest'),roomId=creator.roomId,sim=activeRooms.get(roomId)!.sim,oldMatch=sim.matchId,p=sim.players.get(creator.sessionId)!;
  const token=creator.reconnectionToken;creator.connection.close();await until(()=>p.connected===false,'dropped player');
  guest.send('changeMap','relay');await until(()=>errors.length===1,'guest cannot switch while the host reconnects');assert.equal(activeRooms.get(roomId)!.sim,sim);
  assert.match(errors[0],/Only the room host/);
  states.delete(creator.sessionId);const restored=await new Client(ws).reconnect(token);attach(restored);await until(()=>states.has(restored.sessionId),'host reconnected');assert.equal(states.get(restored.sessionId)!.hostId,restored.sessionId);
  restored.send('changeMap','relay');await until(()=>states.get(guest.sessionId)?.mapId==='relay','host switched map');assert.equal(guest.roomId,roomId);assert.equal(states.get(guest.sessionId)!.mode,'defusal');assert.notEqual(states.get(guest.sessionId)!.matchId,oldMatch);assert.equal(states.get(guest.sessionId)!.round,2);assert.ok(notices.some(n=>n.mapId==='relay'&&n.by==='Creator'));assert.deepEqual(states.get(guest.sessionId)!.impacts,[]);assert.deepEqual(states.get(guest.sessionId)!.sprays,[]);
  restored.send('changeMap','dunes');await until(()=>errors.length===2,'rapid conflicting map request rejected');assert.equal(activeRooms.get(roomId)!.sim.mapId,'relay');
  const inspect=await post({action:'inspect',invite});assert.equal(inspect.status,200);assert.equal(inspect.data.mapId,'relay');assert.equal(inspect.data.roomId,roomId);assert.equal(inspect.data.moreFun,false);assert.equal(server.signs.verify(invite).mapId,'dunes','signed link stays byte-for-byte unchanged');
  const {room:late,data}=await join('Late');assert.equal(data.mapId,'relay');assert.equal(data.fresh,false);assert.equal(late.roomId,roomId);assert.equal(states.get(late.sessionId)!.mapId,'relay');
  assert.equal(restored.sessionId,creator.sessionId);assert.equal(restored.roomId,roomId);assert.equal(states.get(restored.sessionId)!.players.find(p=>p.id===restored.sessionId)!.connected,true);
  await new Promise(r=>setTimeout(r,1550));restored.send('changeMap','dunes');await until(()=>[restored,guest,late].every(room=>states.get(room.sessionId)?.mapId==='dunes'),'all clients return to Dust III');assert.ok([restored,guest,late].every(room=>room.roomId===roomId));assert.equal((await post({action:'inspect',invite})).data.mapId,'dunes');
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});

test('inspecting an invitation does not create a room or reserve a seat',async()=>{
 const server=await createGameServer({secret:'map-inspect-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`;
 try{const invite=server.signs.create(),before=activeRooms.size,r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'inspect',invite})});assert.equal(r.status,404);assert.equal(activeRooms.size,before);}finally{await server.close();}
});
