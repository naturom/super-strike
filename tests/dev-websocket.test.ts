import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocketServer,WebSocket} from 'ws';
import {Client,type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import type {Snapshot} from '@sirocco/shared';

test('development hot reload and game sockets each have one owner on the same port',{timeout:10000},async()=>{
 const server=await createGameServer({secret:'dev-websocket-test-secret-at-least-thirty-two-bytes'}),hmr=new WebSocketServer({noServer:true});
 const sockets:WebSocket[]=[];let upgrades=0,room:Room|undefined;
 server.http.on('upgrade',(req,socket,head)=>{if(!(req.url??'').startsWith('/_next/hmr'))return;upgrades++;hmr.handleUpgrade(req,socket,head,ws=>{sockets.push(ws);ws.on('message',data=>ws.send(data));});});
 try{
  const port=await server.listen(),base=`http://127.0.0.1:${port}`;
  const hot=new WebSocket(`ws://127.0.0.1:${port}/_next/hmr?id=local`);
  await new Promise<void>((resolve,reject)=>{hot.once('open',()=>resolve());hot.once('error',reject);});
  for(const text of ['load-arena','load-avatar','update-module']){
   const echoed=new Promise<string>((resolve,reject)=>{hot.once('message',data=>resolve(data.toString()));hot.once('error',reject);});
   hot.send(text);assert.equal(await echoed,text,'hot reload frames must not reach the game protocol');
  }
  const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Local tester',mapId:'relay'})});
  const data=await response.json();room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;
  const snapshot=await new Promise<Snapshot>(resolve=>room!.onMessage('snapshot',resolve));assert.equal(snapshot.players[0].name,'Local tester');
  assert.equal(upgrades,1);assert.equal(hot.readyState,WebSocket.OPEN,'joining a match must not disturb hot reload');hot.close();
 }finally{
  if(room)await room.leave();for(const socket of sockets)socket.terminate();await new Promise<void>(resolve=>hmr.close(()=>resolve()));await server.close();
 }
 assert.equal(server.http.listening,false,'the shared HTTP listener still closes cleanly');
});
