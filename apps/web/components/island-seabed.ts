import * as THREE from 'three';
import {ISLAND_SEABED,ISLAND_WATER,solidTop} from '@sirocco/shared';

/** One welded surface, shared by the beach edge and every sloping seabed patch. */
export function islandSeabedGeometry(){
 const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],vertices=new Map<string,number>();
 const sand=new THREE.Color('#cbb990'),deep=new THREE.Color('#9aa88d');
 for(const b of ISLAND_SEABED){
  const corners=b.polygon!.map(([x,z])=>{
   const key=`${x.toFixed(6)},${z.toFixed(6)}`;let id=vertices.get(key);
   if(id===undefined){
    id=positions.length/3;vertices.set(key,id);const y=solidTop(b,{x,z});positions.push(x,y,z);uv.push(x/9,z/9);
    const wet=Math.max(0,Math.min(1,y/ISLAND_WATER.bed)),color=sand.clone().lerp(deep,wet).multiplyScalar(.92+.08*Math.sin(x*.23)*Math.cos(z*.19));colors.push(color.r,color.g,color.b);
   }
   return id;
  });
  for(const i of [0,1,2,0,2,3])indices.push(corners[i]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
