import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Client,type Room} from '@colyseus/sdk';
import type {Snapshot} from '@sirocco/shared';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {RoomMapPicker} from '../apps/web/components/RoomMapPicker';

test('the creator owns room controls even when a guest joins first; invitations never grant or disclose host access',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'host-controls-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>(),errors:string[]=[];
 const post=async(body:unknown)=>{const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
 const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<4000,'room state arrived');await new Promise(r=>setTimeout(r,20));}};
 const attach=(room:Room)=>{rooms.push(room);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));room.onMessage('combat',()=>{});room.onMessage('mapChanged',()=>{});room.onMessage('teamsRandomized',()=>{});for(const kind of ['mapChangeError','teamChangeError'])room.onMessage(kind,(data:{message:string})=>errors.push(data.message));return room;};
 const join=async(body:unknown)=>{const data=await post(body);assert.equal(data.hostToken,undefined);const room=attach(await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation));await until(()=>states.has(room.sessionId));return room;};
 try{
  const created=await post({action:'create',mapId:'island',mode:'defusal'}),{invite,hostToken}=created;assert.equal(typeof hostToken,'string');assert.ok(hostToken.length>=40);assert.ok(!invite.includes(hostToken));
  const guest=await join({invite,nickname:'Guest',hostToken:'x'.repeat(hostToken.length),host:true,hostId:'forged'});assert.equal(states.get(guest.sessionId)!.hostId,null);
  for(const action of ['inspect','create']){const data=await post({action,invite});assert.ok(!JSON.stringify(data).includes(hostToken));assert.equal(data.hostToken,undefined);}
  guest.send('changeMap','relay');guest.send('randomizeTeams');await until(()=>errors.length===2);assert.ok(errors.every(e=>e.includes('Only the room host')));assert.equal(activeRooms.get(guest.roomId)!.sim.mapId,'island');
  const host=await join({invite,nickname:'Creator',hostToken});await until(()=>states.get(guest.sessionId)?.hostId===host.sessionId);assert.equal(states.get(host.sessionId)!.hostId,host.sessionId);assert.ok(!JSON.stringify(states.get(guest.sessionId)).includes(hostToken));
  const sim=activeRooms.get(host.roomId)!.sim;sim.finish();sim.time=sim.nextRoundAt;await until(()=>states.get(host.sessionId)?.round===2);assert.equal(states.get(host.sessionId)!.hostId,host.sessionId);
  host.send('changeMap','relay');await until(()=>states.get(guest.sessionId)?.mapId==='relay');assert.equal(states.get(host.sessionId)!.hostId,host.sessionId);
  await host.leave();await until(()=>states.get(guest.sessionId)?.hostId===null);guest.send('randomizeTeams');await until(()=>errors.length===3);assert.match(errors[2],/Only the room host/);
  const returned=await join({invite,nickname:'Creator returned',hostToken});await until(()=>states.get(guest.sessionId)?.hostId===returned.sessionId);assert.notEqual(returned.sessionId,host.sessionId);
  // Compact surface updates must carry the same host identity as full snapshots.
  guest.onMessage('surfaceUpdates',()=>{});guest.send('surfaceUpdates',1);await until(()=>states.get(guest.sessionId)?.impacts===undefined);assert.equal(states.get(guest.sessionId)!.hostId,returned.sessionId);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});

test('room controls are shown only to the host',()=>{
 const props={current:'island' as const,pending:null,shuffling:false,disabled:false,onChange:()=>{},onRandomize:()=>{}};
 const guest=renderToStaticMarkup(React.createElement(RoomMapPicker,{...props,isHost:false}));assert.ok(!guest.includes('<button'));assert.ok(guest.includes('Only the room host'));
 const host=renderToStaticMarkup(React.createElement(RoomMapPicker,{...props,isHost:true}));assert.ok(host.includes('CHANGE MAP'));assert.ok(host.includes('RANDOMIZE TEAMS'));
});
