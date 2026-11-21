import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DUST2,type Solid} from '@sirocco/shared';
import {crateBandGeometry} from '../apps/web/components/crate-bands';

test('wooden-crate straps stand clear of the lid and have one surface at every metal joint',()=>{
 const crates=DUST2.solids.filter(b=>b.kind==='crate'&&b.style!=='metal'),g=crateBandGeometry(crates),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,material),ray=new THREE.Raycaster();
 try{for(const b of crates){
  const single=crateBandGeometry([b]);mesh.geometry=single;try{
  for(const x of [-b.w/2+.13,b.w/2-.13]){
   ray.set(new THREE.Vector3(b.x+x,b.y+b.h/2+1,b.z+.037),new THREE.Vector3(0,-1,0));const lid=ray.intersectObject(mesh);assert.ok(lid.length);assert.ok(Math.abs(lid[0].point.y-(b.y+b.h/2+.06))<1e-5,'lid strap cannot occupy the wood top plane');
   for(const y of [b.y-b.h/2+.12,b.y+b.h/2-.12]){ray.set(new THREE.Vector3(b.x+x+.009,y+.008,b.z+b.d/2+1),new THREE.Vector3(0,0,-1));const hits=ray.intersectObject(mesh),first=hits[0];assert.ok(first);assert.ok(Math.abs(first.point.z-(b.z+b.d/2+.04))<1e-5);assert.equal(hits.filter(h=>Math.abs(h.distance-first.distance)<1e-5).length,1,'one front face at intersecting bands');}
  }
  }finally{single.dispose();}
 }
 mesh.geometry=g;
 const faces=new Set<string>(),p=g.attributes.position;for(let i=0;i<p.count;i+=3){const key=[0,1,2].map(k=>[p.getX(i+k),p.getY(i+k),p.getZ(i+k)].map(n=>n.toFixed(5)).join(',')).sort().join('|');assert.equal(faces.has(key),false,'no duplicate coplanar triangles');faces.add(key);}
 }finally{g.dispose();material.dispose();}
});
test('bands on adjacent crate steps share one exterior surface at their seam',()=>{
 const crates:Solid[]=[{x:-1,y:.5,z:0,w:2,h:1,d:2,kind:'crate'},{x:1,y:1,z:0,w:2,h:2,d:2,kind:'crate'}],g=crateBandGeometry(crates),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,material);
 try{for(const x of [-.031,-.013,.009,.027]){const ray=new THREE.Raycaster(new THREE.Vector3(x,.123,2),new THREE.Vector3(0,0,-1)),hits=ray.intersectObject(mesh);assert.ok(hits.length);assert.equal(hits.filter(h=>Math.abs(h.distance-hits[0].distance)<1e-5).length,1);}}finally{g.dispose();material.dispose();}
});
