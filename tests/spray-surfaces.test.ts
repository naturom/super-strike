import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SprayMarks,sprayRotation} from '../apps/web/components/sprays';
import {spraySurfaceGeometry} from '../apps/web/components/surface-decals';
import {wallWear} from '../apps/web/components/environment-details';
import {WorldArt,disposeGroup} from '../apps/web/components/world';

function fixture(run:(art:WorldArt)=>void){
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,gradient={addColorStop:()=>{}},ctx=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{run(art);}finally{art.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
}
function fullArtwork(geometry:THREE.BufferGeometry,centre:THREE.Vector3,rotation=new THREE.Euler()){
 const ray=new THREE.Raycaster(),normal=new THREE.Vector3(0,0,1).applyEuler(rotation),right=new THREE.Vector3(1,0,0).applyEuler(rotation),up=new THREE.Vector3(0,1,0).applyEuler(rotation),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
 try{for(const u of [.06,.25,.49,.7,.94])for(const v of [.06,.25,.49,.7,.94]){
  const point=centre.clone().addScaledVector(right,(u-.5)*1.15).addScaledVector(up,(v-.5)*1.15);ray.set(point.addScaledVector(normal,.5),normal.clone().negate());
  const hits=ray.intersectObject(mesh);assert.ok(hits.length,`artwork cut off at UV ${u},${v}`);assert.ok(Math.abs(hits[0].uv!.x-u)<1e-5);assert.ok(Math.abs(hits[0].uv!.y-v)<1e-5);
 }}finally{material.dispose();}
}
test('portrait stays complete above Dust III wall grime and ignores cosmetic overlays',()=>fixture(art=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(6,5,.3),art.material('#eee'));wall.position.y=2.5;root.add(wall);
 const facade=new THREE.Group();facade.position.z=.195;root.add(facade);wallWear(art,facade,6,0,0);
 const marks=new SprayMarks(scene);try{
  marks.sync([{id:1,owner:'a',position:{x:0,y:1.6,z:.15},normal:{x:0,y:0,z:1},size:1.15,expiresAt:120000,ray:{origin:{x:0,y:1.6,z:2},direction:{x:0,y:0,z:-1}}}],root);
  assert.equal(scene.children.length,1);const geometry=(scene.children[0] as THREE.Mesh).geometry;fullArtwork(geometry,new THREE.Vector3(0,1.6,.15));
  const bounds=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);assert.ok(bounds.max.y>2.17,'paint must extend above the 1.9m grime strip');assert.ok(Math.abs(bounds.max.z-.15)<1e-5,'paint belongs on masonry');
 }finally{marks.destroy();disposeGroup(root);}
}));
test('one portrait crosses adjacent material batches with continuous UVs, including transformed walls',()=>{
 for(const angle of [0,.8]){const root=new THREE.Group(),materials=[new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial()];root.position.set(3,1,-5);root.rotation.y=angle;
  for(const [i,x] of [-1.5,1.5].entries()){const wall=new THREE.Mesh(new THREE.BoxGeometry(3,4,.3),materials[i]);wall.position.set(x,2,0);root.add(wall);}root.updateMatrixWorld(true);
  const centre=root.localToWorld(new THREE.Vector3(0,1.6,.15)),normal=new THREE.Vector3(0,0,1).transformDirection(root.matrixWorld),rotation=sprayRotation(normal),geometry=spraySurfaceGeometry(root,centre,rotation,new THREE.Vector3(1.15,1.15,.2));
  try{fullArtwork(geometry,centre,rotation);}finally{geometry.dispose();disposeGroup(root);materials.forEach(m=>m.dispose());}
 }
});
test('paint stops at real edges and does not wrap onto perpendicular or rear faces',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),front=new THREE.Mesh(new THREE.PlaneGeometry(.6,2),material),side=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material),rear=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);side.rotation.y=Math.PI/2;side.position.x=.3;rear.rotation.y=Math.PI;rear.position.z=-.04;root.add(front,side,rear);root.updateMatrixWorld(true);
 const geometry=spraySurfaceGeometry(root,new THREE.Vector3(),new THREE.Euler(),new THREE.Vector3(1.15,1.15,.2));
 try{const bounds=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);assert.ok(bounds.max.x<=.30001&&bounds.min.x>=-.30001);assert.ok(Math.abs(bounds.max.z)<1e-6&&Math.abs(bounds.min.z)<1e-6);}finally{geometry.dispose();disposeGroup(root);material.dispose();}
});
