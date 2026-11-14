import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DUST2,MAPS,DT,move,neutralInput,intersects,groundAt,nearbyLadder,type Motion} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {FootstepTracker,LandingTracker,surfaceAt} from '../apps/web/components/combat-audio';

for(const outside of DUST2.ladders!.filter(l=>l.side==='outside'))test(`${outside.label}: climb from outside and drop back into Dust III without an inner ladder`,()=>{
 const yaw=Math.atan2(outside.normal.x,outside.normal.z),inside={x:outside.x-outside.normal.x*3,z:outside.z-outside.normal.z*3};
 let p:Motion={x:outside.x+outside.normal.x*.8,y:outside.bottom,z:outside.z+outside.normal.z*.8,vy:0,grounded:true};
 const used=new Set<string>();let peak=0;
 for(let i=0;i<500;i++){
  p=move(p,{...neutralInput(),forward:1,yaw},DUST2.solids,DUST2.ladders);if(p.climbing)used.add(p.climbing);peak=Math.max(peak,p.y);
  assert.equal(DUST2.solids.some(b=>intersects(p,b)),false,`body intersects masonry at ${JSON.stringify(p)}`);
  const inward=(inside.x-p.x)*outside.normal.x+(inside.z-p.z)*outside.normal.z;
  if(used.size&&p.grounded&&!p.climbing&&inward>.6&&p.y<outside.top-1)break;
 }
 assert.deepEqual([...used],[outside.id]);assert.ok(peak>=outside.top-.001);assert.ok(p.y<outside.top-1);assert.ok(Math.abs(p.y-groundAt(p,DUST2.solids,p.y+.1))<.001);assert.equal(p.climbing,undefined);
 assert.equal(DUST2.ladders!.some(l=>l.id.startsWith('return-')&&l.side==='inside'),false,'there is no inside ladder to climb out');
 assert.equal(MAPS.relay.ladders,undefined);
});

test('outside ladder endpoints have real floors and clear standing headroom',()=>{
 for(const ladder of DUST2.ladders!.filter(l=>l.side==='outside')){
  assert.ok(Math.abs(groundAt(ladder,DUST2.solids,ladder.bottom+.1)-ladder.bottom)<.001);
  for(let y=ladder.bottom;y<=ladder.top;y+=.2)assert.equal(DUST2.solids.some(b=>intersects({...ladder,y},b)),false,ladder.id);
 }
});

test('players inside the perimeter cannot grab the outer ladder through the wall',()=>{
 for(const ladder of DUST2.ladders!.filter(l=>l.side==='outside')){
  const at={x:ladder.x-ladder.normal.x*2,z:ladder.z-ladder.normal.z*2};
  let p:Motion={...at,y:groundAt(at,DUST2.solids,4),vy:0,grounded:true};const floor=p.y,yaw=Math.atan2(-ladder.normal.x,-ladder.normal.z);
  for(let step=0;step<120;step++){p=move(p,{...neutralInput(),forward:1,yaw},DUST2.solids,DUST2.ladders);assert.equal(p.climbing,undefined);assert.equal(p.y,floor);}
  assert.equal(nearbyLadder(p,DUST2.ladders!),undefined);
 }
});

test('a climber can pause, descend with S and let go with Space; ordinary nearby jumps remain normal',()=>{
 const ladder=DUST2.ladders![0],yaw=Math.atan2(ladder.normal.x,ladder.normal.z),base:Motion={...ladder,y:0,vy:0,grounded:true};
 let p=base;for(let i=0;i<35;i++)p=move(p,{...neutralInput(),forward:1,yaw},DUST2.solids,DUST2.ladders);
 assert.equal(p.climbing,ladder.id);const height=p.y;
 for(let i=0;i<50;i++)p=move(p,neutralInput(),DUST2.solids,DUST2.ladders);assert.equal(p.y,height);
 p=move(p,{...neutralInput(),forward:-1,yaw},DUST2.solids,DUST2.ladders);assert.ok(p.y<height);
 p=move(p,{...neutralInput(),jump:true,yaw},DUST2.solids,DUST2.ladders);assert.equal(p.climbing,undefined);assert.equal(p.grounded,false);assert.ok(p.vy>0);
 const away={...base,x:base.x+ladder.normal.x*3,z:base.z+ladder.normal.z*3};assert.equal(nearbyLadder(away,DUST2.ladders!),undefined);
 assert.ok(move(away,{...neutralInput(),jump:true},DUST2.solids,DUST2.ladders).vy>8);
});

test('the server and client use the same ladder movement and climbing does not inflict fall damage',()=>{
 const sim=new Simulation('dunes'),player=sim.add('ladder-test','Climber'),ladder=DUST2.ladders![0],yaw=Math.atan2(ladder.normal.x,ladder.normal.z);
 Object.assign(player,{x:ladder.x,y:0,z:ladder.z,vy:0,grounded:true,protectedUntil:0});let predicted:Motion={...player};
 for(let seq=1;seq<=70;seq++){
  const input={...neutralInput(),seq,spawnId:player.spawnId,forward:seq<35?1:seq<45?0:-1,yaw};predicted=move(predicted,input,DUST2.solids,DUST2.ladders);sim.input(player.id,input);sim.step();
  assert.ok(Math.hypot(player.x-predicted.x,player.y-predicted.y,player.z-predicted.z)<1e-8);assert.equal(player.climbing,predicted.climbing);assert.equal(player.hp,100);
 }
 sim.spawn(player);assert.equal(player.climbing,undefined);
});

test('climbing has metal rung sounds without a false landing impact',()=>{
 const steps=new FootstepTracker(),landing=new LandingTracker(),ladder=DUST2.ladders![0];let heard=0;
 for(let tick=0;tick<45;tick++){
  const p:Motion={x:ladder.x,y:tick*.1,z:ladder.z,vy:0,grounded:true,climbing:ladder.id};
  if(steps.update(p,tick*DT*1000))heard++;assert.equal(landing.update(p,tick*DT*1000),undefined);assert.equal(surfaceAt(p,DUST2.solids),'metal');
 }
 assert.ok(heard>=4);
});
