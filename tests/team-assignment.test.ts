import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {MAPS,neutralInput,type Snapshot,type Team} from '@sirocco/shared';
import {assignRandomTeams} from '../apps/server/src/team-assignment';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('whole-roster random assignment is balanced, deals each player once, and leaves the roster untouched',()=>{
 for(let count=0;count<=8;count++){
  const users=Array.from({length:count},(_,i)=>({id:String(i)})),copy=JSON.stringify(users);
  for(const pick of [(max:number)=>0,(max:number)=>max-1]){
   const teams=assignRandomTeams(users,pick),red=[...teams.values()].filter(team=>team==='red').length,blue=teams.size-red;
   assert.equal(teams.size,count);assert.ok(Math.abs(red-blue)<=1);assert.ok(red<=4&&blue<=4);assert.deepEqual([...teams.keys()].sort(),users.map(user=>user.id).sort());assert.equal(JSON.stringify(users),copy);
   if(count%2)assert.equal(red>blue,pick(2)===0,'either team can receive the odd extra player');
  }
 }
 const users=Array.from({length:8},(_,i)=>({id:String(i)})),forward=assignRandomTeams(users,max=>max-1),shuffled=assignRandomTeams(users,()=>0);assert.notDeepEqual([...forward.keys()],[...shuffled.keys()]);assert.notDeepEqual([...forward.values()],[...shuffled.values()]);
});

test('randomizing teams starts a clean game on the same map and updates appearances, spawns and C4 owners',()=>{
 for(const map of ['dunes','relay'] as const)for(const mode of ['deathmatch','defusal'] as const){
  const sim=new Simulation(map,mode,{red:'wonder-woman',blue:'ironman'},false);for(let i=0;i<6;i++)sim.add(String(i),'Player '+i);
  for(const player of sim.players.values()){player.hp=0;player.kills=3;player.weapon='knife';player.grenades=0;player.dogUsed=true;sim.input(player.id,{...neutralInput(),seq:100});}
  sim.players.get('4')!.connected=false;sim.scores.red=6;sim.time=10000;sim.phase='finished';
  const expected=assignRandomTeams(sim.players.values(),()=>0),next=sim.randomizeTeams(()=>0);
  assert.equal(next.mapId,map);assert.equal(next.mode,mode);assert.equal(next.moreFun,false);assert.deepEqual(next.teamAvatars,sim.teamAvatars);assert.notEqual(next.matchId,sim.matchId);assert.equal(next.round,sim.round+1);assert.equal(next.time,sim.time);assert.equal(next.phase,'playing');assert.deepEqual(next.scores,{red:0,blue:0});assert.equal(next.players.size,6);
  for(const old of sim.players.values()){const player=next.players.get(old.id)!;assert.equal(player.team,expected.get(old.id));assert.equal(player.name,old.name);assert.equal(player.connected,old.connected);assert.equal(player.avatar,next.teamAvatars[player.team]);assert.equal(player.spawnId,old.spawnId+1);assert.equal(player.ack,100);assert.equal(player.hp,100);assert.equal(player.kills,0);assert.equal(player.weapon,'rifle');assert.equal(player.grenades,2);assert.equal(player.dogUsed,undefined);assert.ok(MAPS[map].spawns[player.team].some(s=>s.x===player.x&&s.y===player.y&&s.z===player.z));}
  assert.ok([...next.players.values()].some(p=>p.team!==sim.players.get(p.id)!.team));
  if(mode==='defusal')for(const bomb of next.bombs){assert.equal(bomb.status,'carried');assert.ok(bomb.carrierId);assert.equal(next.players.get(bomb.carrierId!)!.team,bomb.team);assert.equal(next.players.get(bomb.carrierId!)!.connected,true);assert.equal(bomb.explodeAt,0);assert.equal(bomb.action,null);}
 }
});

test('only the host can randomize teams without changing the link or reconnect identities',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'team-shuffle-network-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>(),messages:any[]=[],errors:string[]=[];let invite='';
 const until=async(check:()=>boolean,label:string)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<4000,label);await new Promise(r=>setTimeout(r,20));}};
 function attach(room:Room){rooms.push(room);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));room.onMessage('combat',()=>{});room.onMessage('teamsRandomized',data=>messages.push(data));room.onMessage('teamChangeError',(data:any)=>errors.push(data.message));room.onMessage('mapChangeError',(data:any)=>errors.push(data.message));}
 async function join(name:string){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined,mapId:'relay',mode:'defusal',teamAvatars:{red:'wonder-woman',blue:'ironman'},moreFun:false})}),data=await response.json();assert.equal(response.status,200);if(!invite)invite=data.invite;assert.equal(data.invite,invite);const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);attach(room);await until(()=>states.has(room.sessionId),'joined snapshot');return room;}
 try{
  const creator=await join('Creator'),guest=await join('Guest'),third=await join('Third'),roomId=creator.roomId,sim=activeRooms.get(roomId)!.sim,oldMatch=sim.matchId,token=creator.reconnectionToken;
  creator.connection.close();await until(()=>sim.players.get(creator.sessionId)?.connected===false,'disconnect');guest.send('randomizeTeams');await until(()=>errors.length===1,'guest cannot shuffle');assert.match(errors[0],/Only the room host/);assert.equal(activeRooms.get(roomId)!.sim,sim);
  states.delete(creator.sessionId);const restored=await new Client(base.replace('http:','ws:')).reconnect(token);attach(restored);await until(()=>states.has(restored.sessionId),'reconnected snapshot');
  restored.send('randomizeTeams');await until(()=>states.get(guest.sessionId)?.matchId!==oldMatch&&messages.length===3,'shared host team shuffle');
  const next=activeRooms.get(roomId)!.sim,assigned=new Map([...next.players.values()].map(p=>[p.id,p.team]));assert.equal(next.mapId,'relay');assert.equal(next.mode,'defusal');assert.equal(next.moreFun,false);assert.equal(next.round,2);assert.equal(guest.roomId,third.roomId);assert.ok(messages.every(message=>message.by==='Creator'));
  const red=[...assigned.values()].filter(team=>team==='red').length;assert.ok(Math.abs(red-(3-red))<=1);
  restored.send('changeMap','dunes');await until(()=>errors.length===2,'back-to-back room changes are rejected');assert.equal(activeRooms.get(roomId)!.sim.mapId,'relay');
  assert.equal(restored.sessionId,creator.sessionId);assert.equal(restored.roomId,roomId);
  for(const room of [restored,guest,third]){const state=states.get(room.sessionId)!;assert.equal(state.matchId,next.matchId);assert.equal(state.players.length,3);for(const player of state.players){assert.equal(player.team,assigned.get(player.id));assert.equal(player.avatar,state.teamAvatars![player.team]);}}
  const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'inspect',invite})}),info=await response.json();assert.equal(response.status,200);assert.equal(info.invite,invite);assert.equal(info.roomId,roomId);assert.equal(info.matchId,next.matchId);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
