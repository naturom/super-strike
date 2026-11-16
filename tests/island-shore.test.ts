import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ISLAND_COAST,ISLAND_SEABED,MAPS,solidTop,solidGradient,groundAt,move,neutralInput,wallDistance,impactTarget,type Motion} from '@sirocco/shared';
import {islandSeabedGeometry} from '../apps/web/components/island-seabed';
import {solidGeometry} from '../apps/web/components/map-geometry';

test('shore patches meet at identical heights and descend continuously without vertical risers',()=>{
 for(let i=0;i<ISLAND_SEABED.length;i++){
  const b=ISLAND_SEABED[i],ring=Math.floor(i/64),next=ISLAND_SEABED[ring*64+(i+1)%64];
  for(const p of [b.polygon![1],b.polygon![2]])assert.ok(Math.abs(solidTop(b,{x:p[0],z:p[1]})-solidTop(next,{x:p[0],z:p[1]}))<1e-8);
  if(ring<8)for(const p of [b.polygon![2],b.polygon![3]])assert.ok(Math.abs(solidTop(b,{x:p[0],z:p[1]})-solidTop(ISLAND_SEABED[i+64],{x:p[0],z:p[1]}))<1e-8);
  if(!ring)for(const p of b.polygon!.slice(0,2))assert.ok(Math.abs(solidTop(b,{x:p[0],z:p[1]}))<1e-8);
 }
});

test('sprinting across every shoreline follows the slope smoothly in both directions',()=>{
 for(const a of ISLAND_COAST){
  const angle=Math.atan2(a[1],a[0]),dx=Math.cos(angle),dz=Math.sin(angle);let p:Motion={x:a[0]*.98,y:0,z:a[1]*.98,vy:0,grounded:true};
  for(const sign of [1,-1])for(let i=0;i<85;i++){
   const q=move(p,{...neutralInput(),sprint:true,forward:1,yaw:Math.atan2(-dx*sign,-dz*sign)},MAPS.island.solids);
   assert.ok(Math.abs(q.y-p.y)<.12,`vertical pop ${q.y-p.y} at ${p.x},${p.z}`);assert.equal(q.grounded,true);p=q;
  }
  assert.ok(Math.abs(p.y)<1e-7);
 }
});

test('visible sand, debris geometry, bullet impacts and collision share the exact sloping surface',()=>{
 const geometry=islandSeabedGeometry(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);
 try{
  assert.equal(geometry.attributes.position.count,640);const ray=new THREE.Raycaster();
  for(const b of ISLAND_SEABED.filter((_,i)=>i%7===0)){
   const point={x:b.x,z:b.z},y=solidTop(b,point),origin={...point,y:1},dir={x:0,y:-1,z:0};assert.ok(Math.abs(groundAt(point,MAPS.island.solids)-y)<1e-7);
   ray.set(new THREE.Vector3(point.x,1,point.z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(mesh);assert.equal(hits.length,1);assert.ok(Math.abs(hits[0].point.y-y)<1e-5);
   assert.ok(Math.abs(wallDistance(origin,dir,MAPS.island.solids)-(1-y))<1e-6);const mark=impactTarget(origin,dir,MAPS.island.solids)!;assert.ok(Math.abs(mark.position.y-y)<1e-6);const slope=solidGradient(b),normal=new THREE.Vector3(-slope.x,1,-slope.z).normalize();assert.ok(normal.distanceTo(new THREE.Vector3(mark.normal.x,mark.normal.y,mark.normal.z))<1e-6);
   const debris=new THREE.Mesh(solidGeometry(b),material);debris.updateMatrixWorld(true);try{const contact=ray.intersectObject(debris)[0];assert.ok(contact);assert.ok(Math.abs(contact.point.y-y)<1e-5);}finally{debris.geometry.dispose();}
  }
  const normals=geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>.9,'no vertical stair faces or hard lighting bands');
 }finally{geometry.dispose();material.dispose();}
});
