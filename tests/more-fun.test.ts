import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Client,type Room} from '@colyseus/sdk';
import {DEFAULT_TEAM_AVATARS,WEAPONS,neutralInput,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {signer} from '../apps/server/src/invites';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('More fun is on by default, is signed into invitations, and old links keep that default',()=>{
 const secret='more-fun-signing-secret-at-least-thirty-two-bytes',signs=signer(secret),normal=signs.create(100,'dunes','defusal');
 assert.equal(signs.verify(normal,101).moreFun,true);
 const classic=signs.create(100,'relay','deathmatch',DEFAULT_TEAM_AVATARS,false);assert.equal(signs.verify(classic,101).moreFun,false);
 const [body,sig]=classic.split('.'),payload=JSON.parse(Buffer.from(body,'base64url').toString());payload.moreFun=true;
 assert.throws(()=>signs.verify(Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+sig,101));
 const signed=(p:unknown)=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',secret).update(b).digest('base64url');};
 delete payload.moreFun;assert.equal(signs.verify(signed(payload),101).moreFun,true);
 for(const value of [null,0,1,'false',{},[]])assert.throws(()=>signs.verify(signed({...payload,moreFun:value}),101),/More fun/);
});
test('classic rooms disable both flower guns and creature summons, including after a new game',()=>{
 for(const map of ['dunes','relay'] as const)for(const mode of ['deathmatch','defusal'] as const){
  const sim=new Simulation(map,mode,DEFAULT_TEAM_AVATARS,false),player=sim.add('a','Classic');sim.solids=[];
  for(let round=0;round<2;round++){
   assert.equal(sim.moreFun,false);
   for(const rack of sim.pickups.filter(r=>r.base)){
    Object.assign(player,{x:rack.x,y:rack.y,z:rack.z});sim.pickup(player);assert.equal(player.untestedWeapons,undefined);
    sim.events=[];sim.fire(player);assert.equal(player.ammo[rack.weapon],WEAPONS[rack.weapon].magazine-1);assert.equal(sim.events[0].type,'shot');assert.ok(!player.flowerWeapons?.length);
   }
   for(let i=0;i<5;i++){sim.input(player.id,{...neutralInput(),seq:player.ack+1,weapon:player.weapon,summon:true});sim.step();}
   assert.equal(sim.trexes.length,0);assert.ok(sim.events.every(e=>e.type!=='trexRoar'));
   sim.phase='finished';sim.rematch();
  }
 }
 const enabled=new Simulation([]),p=enabled.add('a','Fun');Object.assign(p,{x:0,y:0,z:10,yaw:0});enabled.input(p.id,{...neutralInput(),seq:1,summon:true});enabled.step();assert.equal(enabled.trexes.length,1);assert.equal(enabled.moreFun,true);
});
test('room creation, guests, reconnect and subsequent games preserve the creator’s More fun setting',{timeout:20000},async()=>{
 const server=await createGameServer({secret:'more-fun-network-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[];
 let state:Snapshot|undefined;
 const post=(body:unknown)=>fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<5000,'room options arrived');await new Promise(r=>setTimeout(r,20));}};
 const attach=(room:Room)=>{rooms.push(room);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>state=s);};
 try{
  for(const value of [null,'off',0,{}])assert.equal((await post({action:'create',moreFun:value})).status,400);
  const defaults=await(await post({action:'create'})).json();assert.equal(defaults.moreFun,true);assert.equal(server.signs.verify(defaults.invite).moreFun,true);
  const created=await(await post({action:'create',mapId:'relay',mode:'deathmatch',moreFun:false})).json();assert.equal(created.moreFun,false);
  const joined=await(await post({invite:created.invite,nickname:'Guest',moreFun:true})).json();assert.equal(joined.moreFun,false,'guest override is ignored');assert.equal(joined.invite,created.invite);
  const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(joined.reservation);attach(room);
  await until(()=>!!state?.players.length);const sim=activeRooms.get(room.roomId)!.sim,p=sim.players.get(room.sessionId)!;
  room.send('input',{...neutralInput(),seq:1,summon:true});await until(()=>p.ack===1);assert.equal(sim.trexes.length,0);
  const token=room.reconnectionToken;room.connection.close();await until(()=>p.connected===false);
  const restored=await new Client(base.replace('http:','ws:')).reconnect(token);state=undefined;attach(restored);await until(()=>!!state?.players.length&&p.connected);assert.equal(sim.moreFun,false);
  sim.phase='finished';sim.rematch();await until(()=>state?.round===2);assert.equal((await(await post({invite:created.invite,action:'create',moreFun:true})).json()).moreFun,false);assert.equal(sim.moreFun,false);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
