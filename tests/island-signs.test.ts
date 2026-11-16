import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JUNGLE_ISLAND} from '@sirocco/shared';
import {islandSiteSign} from '../apps/web/components/island-site-sign';
import {WorldArt,disposeGroup} from '../apps/web/components/world';

test('both island site boards read correctly from either side without a post obscuring the face',()=>{
 const previous=globalThis.document,ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
 const materials:THREE.Material[]=[],textures:THREE.Texture[]=[],timber=new THREE.MeshStandardMaterial();materials.push(timber);
 const art={timber,materials,textures,material:(_color:string,options:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial(options);materials.push(m);return m;}} as unknown as WorldArt;
 try{for(const site of JUNGLE_ISLAND.bombSites!){
  const root=islandSiteSign(art,site);root.updateMatrixWorld(true);
  try{
   for(const side of [1,-1])for(const x of [-.3,0,.3])for(const y of [1.4,1.8,2.2]){
    const origin=root.localToWorld(new THREE.Vector3(side*x,y,side*.5)),direction=new THREE.Vector3(0,0,-side).transformDirection(root.matrixWorld),hits=new THREE.Raycaster(origin,direction,0,1).intersectObject(root,true),hit=hits[0];
    assert.ok(hit);assert.equal(hit.object.name,side>0?'Sign front':'Sign back');assert.ok(Math.abs(hit.distance-.432)<1e-6,'paint and board are physically separated to prevent depth fighting');
    if(x===.3)assert.ok(hit.uv!.x>.75,'back lettering must not be mirrored');
   }
   const front=root.getObjectByName('Sign front') as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>,canvas=front.material.map!.image as HTMLCanvasElement;
   assert.equal(front.geometry.parameters.width/front.geometry.parameters.height,canvas.width/canvas.height,'letters retain the source proportions');
   const board=new THREE.Box3().setFromObject(root.getObjectByName('Wooden sign board')!),post=new THREE.Box3().setFromObject(root.getObjectByName('Sign support')!);assert.ok(board.intersectsBox(post),'the board is attached to its support');
   const camp=JUNGLE_ISLAND.spawns[site.id==='A'?'blue':'red'][0],towardsCamp=new THREE.Vector3(camp.x-root.position.x,0,camp.z-root.position.z).normalize(),normal=new THREE.Vector3(0,0,1).transformDirection(root.matrixWorld);assert.ok(Math.abs(towardsCamp.dot(normal))>.7,'the sign faces the camp approach instead of presenting an edge');
  }finally{disposeGroup(root);}
 }}finally{for(const m of materials)m.dispose();for(const t of textures)t.dispose();globalThis.document=previous;}
});
