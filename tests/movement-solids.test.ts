import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,RADIUS,DT,type Solid} from '@sirocco/shared';
import {movementSolids} from '../packages/shared/src/movement-solids';

test('movement queries retain every possible swept collision and preserve map order on all maps',()=>{
 let seed=8712;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32),radius=RADIUS+8*DT+.002;
 for(const map of Object.values(MAPS)){
  const {solids}=map,b=map.bounds??{minX:-70,maxX:70,minZ:-70,maxZ:70};
  for(let n=0;n<800;n++){
   const x=b.minX+random()*(b.maxX-b.minX),z=b.minZ+random()*(b.maxZ-b.minZ),near=movementSolids(solids,x,z,radius),set=new Set(near);
   for(const s of solids)if(x+radius>=s.x-s.w/2&&x-radius<=s.x+s.w/2&&z+radius>=s.z-s.d/2&&z-radius<=s.z+s.d/2)assert.ok(set.has(s),`${map.id}: missed ${s.label}`);
   assert.deepEqual(near,solids.filter(s=>set.has(s)));
  }
 }
});

test('island movement examines local obstacles instead of hundreds of distant seabed pieces',()=>{
 const {solids}=MAPS.island,counts:number[]=[];
 for(let x=-40;x<=40;x+=4)for(let z=-32;z<=32;z+=4)counts.push(movementSolids(solids,x,z,RADIUS+8*DT+.002).length);
 assert.ok(counts.reduce((a,b)=>a+b,0)/counts.length<20);assert.ok(Math.max(...counts)<60);
 const changed:Solid[]=Array.from({length:64},(_,i)=>({x:100+i*2,y:1,z:100,w:1,h:2,d:1,kind:'wall'}));
 assert.equal(movementSolids(changed,0,0,1).length,0);const added:Solid={x:0,y:1,z:0,w:1,h:2,d:1,kind:'wall'};changed.push(added);assert.ok(movementSolids(changed,0,0,1).includes(added));
});

