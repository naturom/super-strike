import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Solid} from '@sirocco/shared';
import {visibleSolidGeometry} from './map-geometry';

/** One metal skin, including joints between adjacent crates. The lid straps
 * stand clear of the wood instead of sharing its exact top plane. */
export function crateBandGeometry(crates:readonly Solid[]){
 const bands:Solid[]=[];
 for(const b of crates){
  const band=(w:number,h:number,d:number,x:number,y:number)=>bands.push({x,y,z:b.z,w,h,d,kind:'crate',style:'metal'});
  for(const y of [b.y-b.h/2+.12,b.y+b.h/2-.12])band(b.w+.08,.11,b.d+.08,b.x,y);
  for(const x of [-b.w/2+.13,b.w/2-.13])band(.1,b.h+.12,b.d+.08,b.x+x,b.y);
  if(b.h>2)band(b.w+.08,.09,b.d+.08,b.x,b.y);
 }
 const parts=bands.map(b=>visibleSolidGeometry(b,bands)),geometry=parts.length?mergeGeometries(parts)!:new THREE.BufferGeometry();for(const part of parts)part.dispose();return geometry;
}
