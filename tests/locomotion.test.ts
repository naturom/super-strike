import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Locomotion,footfall,firstPersonGait,type Gait} from '../apps/web/components/locomotion';
const tau=Math.PI*2;
function travel(speed:number,fps=60,crouched=false,x=0,z=-1){const motion=new Locomotion();motion.update({x:0,z:0},0,1/fps,true,crouched);for(let i=1;i<=fps*2;i++)motion.update({x:x*speed*i/fps,z:z*speed*i/fps},0,1/fps,true,crouched);return motion;}
test('walking and running have distinct stride length, support time and lift at sensible cadences',()=>{
 const walk=travel(5.5).value,run=travel(8).value,crouch=travel(2.5,60,true).value;
 assert.ok(run.cycleLength>walk.cycleLength+.5);assert.ok(run.stance<walk.stance);assert.ok(8/run.cycleLength<3);assert.equal(crouch.run,0);
 const peak=(g:Gait)=>Math.max(...Array.from({length:120},(_,i)=>footfall({...g,phase:i*tau/120},0,g===crouch?1:0).lift));
 assert.ok(peak(run)>peak(walk)+.04);assert.ok(peak(crouch)<.04);
});
test('support feet stay planted in world space while swing feet clear the floor',()=>{
 for(const g of [travel(5.5).value,travel(8).value,travel(2.5,60,true).value]){
  const speed=g.speed,t0=g.stance*.18,t1=g.stance*.65;
  const a=footfall({...g,phase:t0*tau},0),b=footfall({...g,phase:t1*tau},0);
  const elapsed=(t1-t0)*g.cycleLength/speed;
  assert.ok(Math.abs((b.z-a.z)-(-g.z*speed*elapsed))<1e-10);assert.equal(a.lift,0);assert.equal(b.lift,0);
  const swing=footfall({...g,phase:(g.stance+(1-g.stance)*.5)*tau},0);assert.ok(swing.lift>.03);assert.equal(swing.contact,false);
 }
});
test('foot trajectories follow strafing, backpedalling and facing instead of always marching forward',()=>{
 const right=travel(5.5,60,false,1,0).value,back=travel(5.5,60,false,0,1).value;
 assert.ok(right.x>.99&&Math.abs(right.z)<1e-8);assert.ok(back.z>.99);
 const step=footfall({...right,phase:0},0);assert.ok(step.x>.3&&Math.abs(step.z)<1e-8);
 const turn=new Locomotion();turn.update({x:0,z:0},Math.PI/2,1/60,true);for(let i=1;i<=60;i++)turn.update({x:-i*5.5/60,z:0},Math.PI/2,1/60,true);assert.ok(turn.value.z<-.99,'westward motion is forward when facing west');
});
test('stops ease to neutral, airborne/ladder motion does not run, and teleports do not kick the legs',()=>{
 const moving=travel(8),position={x:0,z:-16};let before=moving.value.weight;
 moving.update(position,0,1/60,true);assert.ok(moving.value.weight>.5);
 for(let i=0;i<100;i++)moving.update(position,0,1/60,true);assert.equal(moving.value.weight,0);
 const phase=moving.value.phase;moving.update({x:50,z:50},0,1/60,true);assert.equal(moving.value.phase,phase);assert.equal(moving.value.weight,0);
 for(const state of [{grounded:false,climbing:false},{grounded:true,climbing:true}]){
  const motion=travel(8);before=motion.value.phase;for(let i=0;i<60;i++)motion.update({x:0,z:-16-i*.05},0,1/60,state.grounded,false,state.climbing);
  assert.equal(motion.value.phase,before);assert.equal(motion.value.weight,0);
 }
});
test('movement stays consistent across frame rates and reduced-motion removes first-person sway',()=>{
 const values=[30,60,144].map(fps=>travel(8,fps).value),ref=values[1];
 for(const gait of values){assert.ok(Math.abs(Math.atan2(Math.sin(gait.phase-ref.phase),Math.cos(gait.phase-ref.phase)))<.16);assert.ok(Math.abs(gait.speed-8)<.001);assert.ok(Object.values(firstPersonGait(gait,true)).every(v=>Math.abs(v)<1e-10));}
 assert.ok(Object.values(firstPersonGait(ref)).some(v=>Math.abs(v)>.001));
});
