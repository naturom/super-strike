import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DT,GUNS,WEAPONS,neutralInput,type Input,type CombatEvent} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {ShotFeedback} from '../apps/web/components/shot-feedback';
import {ShotFlight} from '../apps/web/components/shot-flight';

test('local feedback precedes network replies and matches server cadence/reloads for every gun',()=>{
 for(const weapon of GUNS){
  const server=new Simulation([]),p=server.add('local','Tester'),feedback=new ShotFeedback();
  p.primary=weapon;p.weapon=weapon;p.ammo[weapon]=WEAPONS[weapon].magazine;
  feedback.sync(server.snapshot().players[0],server.time,[]);
  let pending:Input[]=[],replies:CombatEvent[]=[],predicted=0,confirmed=0;
  for(let seq=1;seq<=240;seq++){
   const i={...neutralInput(),seq,spawnId:p.spawnId,weapon,fire:WEAPONS[weapon].automatic||seq%8===0,reload:seq===95||seq===180,sprint:seq>=70&&seq<80,crouch:seq>=75&&seq<80};
   // Feedback has no access to this input's server result yet.
   const shown=feedback.predict(i,seq*DT*1000);if(shown)predicted++;
   pending.push(i);server.input(p.id,i);server.step();
   const shots=server.events.filter(e=>e.type==='shot');
   assert.equal(!!shown,!!shots.length,`${weapon}, input ${seq}: speculative cadence must match authority`);
   for(const shot of shots){assert.equal(shot.inputSeq,seq);assert.equal(shot.spawnId,p.spawnId);replies.push(shot);}
   // Delayed confirmations and snapshots must neither replay shots nor erase
   // outstanding records. Replay inputs newer than the snapshot's acknowledgement.
   if(seq%6===0){for(const event of replies){assert.equal(feedback.confirm(event),true);confirmed++;}replies=[];}
   if(seq%5===0){const state=server.snapshot();pending=pending.filter(i=>i.seq>state.players[0].ack);feedback.sync(state.players[0],state.time,pending);}
  }
  assert.ok(predicted>=4,`${weapon}: exercised multiple shots`);assert.equal(predicted,confirmed);
 }
});

test('pending replay does not duplicate a shot, and life/weapon changes reset prediction safely',()=>{
 const server=new Simulation([]),p=server.add('a','A'),feedback=new ShotFeedback();
 const initial=server.snapshot();feedback.sync(initial.players[0],initial.time,[]);
 const pending:Input[]=[];
 for(let seq=1;seq<=12;seq++){
  const input={...neutralInput(),seq,spawnId:p.spawnId,fire:true};pending.push(input);feedback.predict(input,seq*DT*1000);
 }
 feedback.sync(initial.players[0],initial.time,pending);
 const next={...neutralInput(),seq:13,spawnId:p.spawnId,fire:true};
 assert.equal(feedback.predict(next,433),undefined,'replay preserves the outstanding cooldown');
 for(const input of pending){server.input(p.id,input);server.step();for(const event of server.events.filter(e=>e.type==='shot'))assert.equal(feedback.confirm(event),true);}
 server.spawn(p);feedback.sync(server.snapshot().players[0],server.time,[]);
 assert.equal(feedback.confirm({id:1,type:'shot',shooter:p.id,team:p.team,weapon:'rifle',from:p,to:p,inputSeq:3,spawnId:p.spawnId-1}),false,'old life cannot suppress new shots');
 const switched={...neutralInput(),seq:14,spawnId:p.spawnId,fire:true,weapon:'pistol' as const};
 assert.equal(feedback.predict(switched,466),undefined,'drawing a pistol respects the draw delay');
});

test('tracer advances at the same speed at 30/60/144 fps, stops at the target and expires',()=>{
 const start=new THREE.Vector3(3,2,5),end=new THREE.Vector3(3,2,-145),flight=new ShotFlight(start,end,1000);
 start.set(99,99,99);end.set(99,99,99);
 for(const fps of [30,60,144]){
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);let last=-1;
  for(let now=1000;now<flight.until;now+=1000/fps){
   flight.write(geometry,now);const tail=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,0),head=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,1),distance=flight.origin.distanceTo(head);
   assert.ok(distance>=last-1e-5);last=distance;assert.ok(distance<=150.00001);assert.ok(tail.distanceTo(head)<=10.00001);
   assert.ok(Math.abs(distance-Math.min(150,Math.max(2,(now-1000)*.9)))<1e-5);
  }
  flight.write(geometry,flight.until);assert.ok(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,1).distanceTo(flight.target)<1e-5);geometry.dispose();
 }
 assert.ok(flight.until<1200,'no lingering laser beam');
});
