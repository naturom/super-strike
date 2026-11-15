import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client,type Room} from '@colyseus/sdk';
import {neutralInput,type CombatEvent,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {TeamRadio,RADIO_AUDIO,type RadioLine} from '../apps/web/components/team-radio';
import {GameAudio} from '../apps/web/components/audio';
function fixture(){const sim=new Simulation([]),me=sim.add('a','A'),enemy=sim.add('b','B'),ally=sim.add('c','C');return {sim,me,enemy,ally};}
test('game-start radio waits for entering, plays once per game, and never repeats for respawn or reconnect',()=>{
 const {sim,me}=fixture(),heard:RadioLine[]=[],radio=new TeamRadio(line=>heard.push(line));
 radio.update(sim.snapshot(),me.id);radio.update(sim.snapshot(),me.id);assert.deepEqual(heard,[]);radio.enter();radio.enter();assert.deepEqual(heard,['go']);
 sim.spawn(me);radio.update(sim.snapshot(),me.id);radio.pause();radio.update(sim.snapshot(),me.id);radio.enter();assert.deepEqual(heard,['go']);
 sim.phase='finished';radio.update(sim.snapshot(),me.id);sim.rematch();radio.update(sim.snapshot(),me.id);radio.update(sim.snapshot(),me.id);assert.deepEqual(heard,['go','go']);
 radio.reset();sim.phase='finished';radio.update(sim.snapshot(),me.id);radio.enter();assert.deepEqual(heard,['go','go'],'joining a finished game cannot announce a start');
});
test('only authoritative grenade releases announce, and only to the thrower and their team',()=>{
 const {sim,me,enemy,ally}=fixture(),players=[me,enemy,ally],heard=players.map(()=>[] as RadioLine[]),radios=players.map((p,i)=>{const radio=new TeamRadio(line=>heard[i].push(line));radio.update(sim.snapshot(),p.id);radio.enter();return radio;});
 const event=(type:CombatEvent['type'],id:number):CombatEvent=>({type,id,shooter:me.id,team:me.team,weapon:'grenade',from:me,to:me});
 for(const type of ['grenadePrime','explosion','shot'] as const)radios.forEach((radio,i)=>radio.combat(event(type,1),sim.snapshot(),players[i].id));
 assert.deepEqual(heard,[['go'],['go'],['go']]);
 radios.forEach((radio,i)=>{radio.combat(event('grenade',2),sim.snapshot(),players[i].id);radio.combat(event('grenade',2),sim.snapshot(),players[i].id);});
 assert.deepEqual(heard,[['go','grenade'],['go'],['go','grenade']]);
 me.hp=0;radios[0].combat({...event('grenade',3),shooter:ally.id},sim.snapshot(),me.id);assert.equal(heard[0].at(-1),'grenade','dead teammates still hear team radio');assert.equal(heard[0].length,3);
});
function audioFixture(){
 const audio=new GameAudio(),sources:any[]=[],master={gain:{setTargetAtTime(){}}},context={state:'running',createBufferSource(){const source={buffer:null,startCount:0,stopCount:0,connect(){return this;},disconnect(){},start(){this.startCount++;},stop(){this.stopCount++;}};sources.push(source);return source;},createGain(){return {gain:{value:0},connect(){return this;},disconnect(){}};},async decodeAudioData(data:ArrayBuffer){return {bytes:data.byteLength};}};
 Object.assign(audio,{context,master});return {audio,context,sources};
}
test('approved recordings load once, queue during decoding, and play unattenuated through the sound master',async()=>{
 const {audio,sources}=audioFixture(),original=globalThis.fetch;let requests=0;globalThis.fetch=(async url=>{requests++;const bytes=readFileSync('apps/web/public'+url);return new Response(bytes);}) as typeof fetch;
 try{for(const url of Object.values(RADIO_AUDIO)){const bytes=readFileSync('apps/web/public'+url);assert.ok(bytes.length>5000);assert.equal(bytes.toString('ascii',0,3),'ID3');}
  audio.radio('go');audio.radio('grenade');await (audio as any).radioLoad;assert.equal(requests,2);assert.equal(sources.length,2);assert.ok(sources.every(source=>source.startCount===1&&source.buffer.bytes>5000));
  audio.radio('grenade');assert.equal(requests,2);assert.equal(sources.length,3);assert.equal(sources[1].buffer,sources[2].buffer);audio.stopCombat();assert.ok(sources.every(source=>source.stopCount===1));
 }finally{globalThis.fetch=original;}
});
test('leaving or muting cancels deferred calls so old shouts cannot play after loading',async()=>{
 for(const action of ['leave','mute'] as const){const {audio,sources}=audioFixture(),original=globalThis.fetch;let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);globalThis.fetch=(async()=>{await wait;return new Response(new Uint8Array(32));}) as typeof fetch;
  try{audio.radio('go');if(action==='mute')audio.setEnabled(false);else audio.stopCombat();release();await (audio as any).radioLoad;assert.equal(sources.length,0);}finally{globalThis.fetch=original;}
 }
});
test('real teammates hear the same release once, holding stays quiet, and the next game announces again',{timeout:20000},async()=>{
 const server=await createGameServer({secret:'team-radio-network-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>(),heard=new Map<string,RadioLine[]>();let invite='';
 const until=async(check:()=>boolean,label:string)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<5000,label);await new Promise(r=>setTimeout(r,20));}};
 async function join(name:string){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined,mapId:'relay'})}),data=await r.json();invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);rooms.push(room);room.reconnection.enabled=false;const lines:RadioLine[]=[];heard.set(room.sessionId,lines);const radio=new TeamRadio(line=>lines.push(line));radio.enter();room.onMessage('snapshot',(state:Snapshot)=>{states.set(room.sessionId,state);radio.update(state,room.sessionId);});room.onMessage('combat',(event:CombatEvent)=>radio.combat(event,states.get(room.sessionId),room.sessionId));await until(()=>states.has(room.sessionId),'first snapshot');return room;}
 try{
  const owner=await join('Thrower'),enemy=await join('Enemy'),ally=await join('Teammate'),sim=activeRooms.get(owner.roomId)!.sim,p=sim.players.get(owner.sessionId)!;sim.solids=[];
  owner.send('input',{...neutralInput(),weapon:'grenade',seq:1,fire:true});await until(()=>!!p.grenadeThrow,'pin pulled');await new Promise(r=>setTimeout(r,800));for(const lines of heard.values())assert.deepEqual(lines,['go']);
  owner.send('input',{...neutralInput(),weapon:'grenade',seq:2,fire:false});await until(()=>heard.get(ally.sessionId)!.includes('grenade'),'team release radio');assert.deepEqual(heard.get(owner.sessionId),['go','grenade']);assert.deepEqual(heard.get(enemy.sessionId),['go']);assert.deepEqual(heard.get(ally.sessionId),['go','grenade']);
  sim.phase='finished';sim.rematch();await until(()=>[...heard.values()].every(lines=>lines.filter(line=>line==='go').length===2),'new-game radio');
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
