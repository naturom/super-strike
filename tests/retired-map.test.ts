import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Client,type Room} from '@colyseus/sdk';
import {MAPS,DEFAULT_MAP,validMap,type Snapshot} from '@sirocco/shared';
import {signer} from '../apps/server/src/invites';
import {createGameServer} from '../apps/server/src/http';

test('Snowbound is unavailable while its authenticated invitations retain their identity on Dust III',async()=>{
 assert.equal(validMap('snowbound'),false);assert.ok(!('snowbound' in MAPS));
 const secret='retired-map-invitation-test-at-least-thirty-two-bytes',payload={v:1,id:'a'.repeat(32),exp:Date.now()+60000,mapId:'snowbound',mode:'defusal'},body=Buffer.from(JSON.stringify(payload)).toString('base64url'),invite=body+'.'+createHmac('sha256',secret).update(body).digest('base64url'),verified=signer(secret).verify(invite);
 assert.equal(verified.mapId,DEFAULT_MAP);assert.equal(verified.id,payload.id);assert.equal(verified.mode,'defusal');assert.throws(()=>signer(secret).verify(invite.slice(0,-5)+'wrong'));
 const invalidBody=Buffer.from(JSON.stringify({...payload,mapId:null})).toString('base64url');assert.throws(()=>signer(secret).verify(invalidBody+'.'+createHmac('sha256',secret).update(invalidBody).digest('base64url')),/Invalid map/);
 const server=await createGameServer({secret}),port=await server.listen(),base=`http://127.0.0.1:${port}`;let room:Room|undefined,state:Snapshot|undefined;
 try{
  const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,nickname:'Old invitation'})}),data=await response.json();assert.equal(response.status,200);assert.equal(data.invite,invite);assert.equal(data.mapId,DEFAULT_MAP);
  room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>state=s);room.onMessage('combat',()=>{});const started=Date.now();while(!state){assert.ok(Date.now()-started<4000);await new Promise(r=>setTimeout(r,20));}assert.equal(state.mapId,DEFAULT_MAP);
  const rejected=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapId:'snowbound',nickname:'New room'})});assert.equal(rejected.status,400);
 }finally{if(room?.connection.isOpen)await room.leave();await server.close();}
});
