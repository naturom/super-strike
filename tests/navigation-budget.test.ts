import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,groundAt,inWater,intersects,type Vec3} from '@sirocco/shared';
import {TrexNavigation} from '../apps/server/src/trex-navigation';

test('indexed navigation preserves exact floor, water and obstacle checks on every map',()=>{
 let seed=4093;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(const map of Object.values(MAPS))for(const profile of [{height:.8,radius:.26},{height:3.35,radius:.75}]){
  const nav=new TrexNavigation(map.solids,map,profile),b=nav.bounds;
  for(let n=0;n<400;n++){const x=b.minX+profile.radius+random()*(b.maxX-b.minX-profile.radius*2),z=b.minZ+profile.radius+random()*(b.maxZ-b.minZ-profile.radius*2),p={x,z,y:groundAt({x,z},map.solids,5.5)},expected=inWater(p,map.water)||map.solids.some(s=>intersects({...p,y:p.y+.012},s,profile.height,profile.radius))?undefined:p;assert.deepEqual(nav.point(x,z),expected,`${map.id}: navigation changed at ${x},${z}`);}
 }
});
test('cold cave searches share a bounded fair budget and produce the same valid route as a synchronous search',()=>{
 const map=MAPS.caverns,nav=new TrexNavigation(map.solids,map,{height:.8,radius:.26,cell:.8,maxStep:.4}),from=map.spawns.red[0],to=map.spawns.blue[0],jobs=Array.from({length:6},()=>nav.request(from,to));assert.ok(jobs.every(j=>!j.done&&j.iterations===0));
 assert.equal(nav.work(0,Infinity,6),6);assert.ok(jobs.every(j=>j.iterations===1),'each dog gets work before any gets a second turn');assert.equal(nav.work(0,Infinity,24),0,'a tick cannot spend its work budget twice');
 let tick=0;while(jobs.some(j=>!j.done)){assert.ok(++tick<800,'queued routes eventually complete');assert.ok(nav.work(tick,Infinity,24)<=24);}
 const expected=nav.path(from,to);assert.ok(expected.length>50);for(const job of jobs){assert.deepEqual(job.route,expected);for(let i=1;i<job.route.length;i++)assert.ok(nav.clear(job.route[i-1],job.route[i]));}
 const cancelled=nav.request(from,to);nav.cancel(cancelled);assert.equal(nav.work(++tick,Infinity,24),0);assert.deepEqual(cancelled.route,[]);
 const pending=nav.request(from,to);nav.clearWork();assert.equal(pending.done,true);assert.equal(nav.work(++tick,Infinity,24),0);
});
