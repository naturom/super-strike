import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DT,move,neutralInput,type Input,type Motion,type Solid} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {MovementCorrection} from '../apps/web/components/movement-correction';

test('a delayed burst of island running inputs no longer visibly pulls the camera backward',()=>{
 const s=new Simulation('island'),p=s.add('a','Runner'),correction=new MovementCorrection();Object.assign(p,{x:-36,y:0,z:18});
 let predicted:Motion={...p},pending:Input[]=[],held:Input[]=[],last={...p},worstRaw=0,worstVisible=0;
 const ux=14/Math.hypot(14,5),uz=-5/Math.hypot(14,5);
 for(let tick=1;tick<=120;tick++){
  const input={...neutralInput(),seq:tick,spawnId:p.spawnId,forward:tick<=60?1:0,sprint:true,yaw:Math.atan2(-14,5)};
  pending.push(input);predicted=move(predicted,input,s.solids);held.push(input);
  // A 400 ms delivery stall fills the server's bounded queue and drops old inputs.
  if(tick<30||tick>=42){for(const i of held)s.input(p.id,i);held=[];}s.step();
  if(tick%3===0){
   const before=predicted;pending=pending.filter(i=>i.seq>p.ack);predicted={...p};for(const i of pending)predicted=move(predicted,i,s.solids);
   worstRaw=Math.max(worstRaw,(before.x-predicted.x)*ux+(before.z-predicted.z)*uz);correction.reconcile(before,predicted);
  }
  correction.advance(DT);const rendered=correction.position(predicted,s.solids);
  if(tick<=60)worstVisible=Math.max(worstVisible,(last.x-rendered.x)*ux+(last.z-rendered.z)*uz);
  assert.ok(Math.hypot(rendered.x-predicted.x,rendered.z-predicted.z)<=3);last={...p,...rendered};
 }
 assert.ok(worstRaw>1.3,'fixture reproduces the old one-metre rollback');assert.ok(worstVisible<1e-6,`visible backward shift: ${worstVisible}`);
 assert.ok(Math.hypot(last.x-predicted.x,last.z-predicted.z)<.001,'correction converges after stopping');
});

test('small corrections cannot take the viewpoint through a thin wall or trunk',()=>{
 const p:Motion={x:0,y:0,z:0,vy:0,grounded:true},wall:Solid={x:1,y:1,z:0,w:.1,h:2,d:4,kind:'wall'};
 const c=new MovementCorrection();c.reconcile({...p,x:2},p);assert.deepEqual(c.position(p,[wall]),p);assert.deepEqual(c.position(p,[]),p);
});

test('respawns, teleports and changes in floor height clear cosmetic correction immediately',()=>{
 const p:Motion={x:0,y:0,z:0,vy:0,grounded:true};
 for(const [after,reset] of [[p,true],[{...p,x:20},false],[{...p,y:2},false]] as const){const c=new MovementCorrection();c.reconcile({...p,x:.5},p);c.reconcile(p,after,reset);assert.deepEqual(c.position(after,[]),after);}
 const c=new MovementCorrection();assert.equal(c.position(p,[]),p);
});
