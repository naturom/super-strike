import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DUST2,dustPoint,scoutTowerRoute,SCOUT_TOWER,move,neutralInput,intersects,wallDistance,type Motion} from '@sirocco/shared';
const ladder=DUST2.ladders!.find(l=>l.id==='scout-tower')!;
function walk(p:Motion,target:{x:number;y:number;z:number}){
 for(let step=0;step<400&&Math.hypot(target.x-p.x,target.z-p.z)>.13;step++){
  p=move(p,{...neutralInput(),forward:1,yaw:Math.atan2(p.x-target.x,p.z-target.z)},DUST2.solids,DUST2.ladders);
  assert.equal(DUST2.solids.some(b=>intersects(p,b)),false,'standing head clearance');
 }
 assert.ok(Math.hypot(target.x-p.x,target.z-p.z)<.15,`blocked approaching ${JSON.stringify(target)} from ${JSON.stringify(p)}`);
 assert.ok(Math.abs(p.y-target.y)<.24,`wrong elevation ${p.y} vs ${target.y}`);return p;
}
test('tower can be entered from Catwalk, climbed by ladder, and descended without jumping',()=>{
 const route=scoutTowerRoute().map(p=>dustPoint(p.u,p.v,p.y));let p:Motion={...route[0],vy:0,grounded:true};
 for(const target of route.slice(1,3))p=walk(p,target);
 let climbed=false;
 for(let step=0;step<220;step++){
  p=move(p,{...neutralInput(),forward:1,yaw:0},DUST2.solids,DUST2.ladders);climbed ||= p.climbing===ladder.id;
  assert.equal(DUST2.solids.some(b=>intersects(p,b)),false);
  if(p.y===SCOUT_TOWER.deck&&!p.climbing&&p.z<dustPoint(567,480).z)break;
 }
 assert.ok(climbed);p=walk(p,route[3]);assert.equal(p.y,SCOUT_TOWER.deck);
 let descended=false;
 for(let step=0;step<250;step++){
  p=move(p,{...neutralInput(),forward:-1,yaw:0},DUST2.solids,DUST2.ladders);descended ||= p.climbing===ladder.id;
  assert.equal(DUST2.solids.some(b=>intersects(p,b)),false);
  if(p.y===SCOUT_TOWER.base&&!p.climbing&&p.z>ladder.z+.8)break;
 }
 assert.ok(descended);assert.equal(p.y,SCOUT_TOWER.base);
 p=walk(p,route[1]);p=walk(p,route[0]);assert.equal(p.climbing,undefined);
 assert.equal(DUST2.solids.some(b=>b.label?.startsWith('Scout tower')&&/stair|landing/.test(b.label)),false,'no stairs or old landings remain');
});
test('lookout accommodates several standing players above the playable buildings',()=>{
 assert.equal(SCOUT_TOWER.floors,8,'lookout remains at the eighth-floor height');assert.ok(SCOUT_TOWER.deck>14);
 for(const u of [542,554,566,578,590]){const p={...dustPoint(u,563,SCOUT_TOWER.deck),vy:0,grounded:true};assert.equal(DUST2.solids.some(b=>intersects(p,b)),false);const landed=move(p,neutralInput(),DUST2.solids);assert.equal(landed.y,SCOUT_TOWER.deck);}
 const eye=dustPoint(567,562,SCOUT_TOWER.deck+1.6);for(const dir of [{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}])assert.ok(wallDistance(eye,dir,DUST2.solids)>25,'clear scouting sightline over parapets');
});

test('players can walk a complete circuit on all four lookout sides',()=>{
 const points=[[525,577],[525,473],[609,473],[609,577],[525,577]];
 let p:Motion={...dustPoint(525,577,SCOUT_TOWER.deck),vy:0,grounded:true};
 for(const [u,v] of points.slice(1)){
  const target=dustPoint(u,v,SCOUT_TOWER.deck);
  for(let step=0;step<200&&Math.hypot(target.x-p.x,target.z-p.z)>.13;step++)p=move(p,{...neutralInput(),forward:1,yaw:Math.atan2(p.x-target.x,p.z-target.z)},DUST2.solids);
  assert.ok(Math.hypot(target.x-p.x,target.z-p.z)<.15,`blocked on lookout at ${u},${v}`);assert.equal(p.y,SCOUT_TOWER.deck);
 }
 for(const b of DUST2.solids.filter(b=>b.label?.startsWith('Scout tower lookout parapet')))assert.ok(b.h<=.8,'outer parapets must not block the view');
});
test('the smaller ladder hatch is guarded on three sides and the former stairwell is filled',()=>{
 const eye=dustPoint(567,497,SCOUT_TOWER.deck+.5);
 for(const dir of [{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1}])assert.ok(wallDistance(eye,dir,DUST2.solids)<1.3,'hatch guard within reach');
 assert.ok(wallDistance(eye,{x:0,y:0,z:-1},DUST2.solids)>2.5,'exit opens onto north walkway');
 for(const [u,v] of [[547,515],[567,525],[587,535]]){
  const p={...dustPoint(u,v,SCOUT_TOWER.deck),vy:0,grounded:true};assert.equal(move(p,neutralInput(),DUST2.solids).y,SCOUT_TOWER.deck);
 }
 for(let y=ladder.bottom;y<ladder.top;y+=.1)assert.equal(DUST2.solids.some(b=>intersects({...ladder,y},b)),false,'ladder shaft has standing clearance');
});

test('tower shaft walls terminate beneath the lookout slab without coplanar floor strips',()=>{
 const labels=['west wall north','west wall south','entry lintel','north wall','east wall','south wall'];
 for(const label of labels){const b=DUST2.solids.find(b=>b.label===`Scout tower ${label}`)!;assert.ok(b.y+b.h/2<=SCOUT_TOWER.deck-.219);} 
});
