import * as THREE from 'three';
import {surfaceDecalGeometry} from './surface-decals';
import type {Vec3,Spray} from '@sirocco/shared';

/** Transparent, tightly framed character artwork; one texture shared by all marks. */
export function portraitSprayTexture(){
 const texture=new THREE.TextureLoader().load('/sprays/operator-portrait.webp');
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
/** Freeze the artwork's screen-up direction from the original spray aim. */
export function sprayRotation(surfaceNormal:THREE.Vector3,aim?:Vec3){
 const normal=surfaceNormal.clone().normalize(),up=new THREE.Vector3(0,1,0);
 if(aim){
  const forward=new THREE.Vector3(aim.x,aim.y,aim.z).normalize();
  // Reconstruct camera up (no roll), then project it onto the receiving plane.
  up.addScaledVector(forward,-up.dot(forward));
 }
 up.addScaledVector(normal,-up.dot(normal));
 if(up.lengthSq()<1e-8&&aim){up.set(aim.x,aim.y,aim.z);up.addScaledVector(normal,-up.dot(normal));}
 if(up.lengthSq()<1e-8){up.set(0,0,-1);up.addScaledVector(normal,-up.dot(normal));}
 if(up.lengthSq()<1e-8){up.set(1,0,0);up.addScaledVector(normal,-up.dot(normal));}
 up.normalize();const right=new THREE.Vector3().crossVectors(up,normal).normalize();up.crossVectors(normal,right).normalize();
 return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));
}

export class SprayMarks {
 private marks=new Map<number,THREE.Mesh>();private texture=portraitSprayTexture();
 private material=new THREE.MeshStandardMaterial({map:this.texture,transparent:true,alphaTest:.03,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,roughness:1,side:THREE.DoubleSide});
 constructor(private scene:THREE.Scene){}
 sync(sprays:Spray[],map:THREE.Object3D){
  const ids=new Set(sprays.map(s=>s.id));for(const [id,mesh] of this.marks)if(!ids.has(id)){mesh.removeFromParent();mesh.geometry.dispose();this.marks.delete(id);}
  if(sprays.every(s=>this.marks.has(s.id)))return;map.updateMatrixWorld(true);
  for(const spray of sprays){if(this.marks.has(spray.id))continue;
   const position=new THREE.Vector3(spray.position.x,spray.position.y,spray.position.z),normal=new THREE.Vector3(spray.normal.x,spray.normal.y,spray.normal.z);
   // The server validates range/occlusion against shared collision. Raycast the
   // detailed render mesh as well, so paint follows sloped car panels and trim.
   const ray=spray.ray?new THREE.Raycaster(new THREE.Vector3(spray.ray.origin.x,spray.ray.origin.y,spray.ray.origin.z),new THREE.Vector3(spray.ray.direction.x,spray.ray.direction.y,spray.ray.direction.z).normalize(),0,4.02):new THREE.Raycaster(position.clone().addScaledVector(normal,.10),normal.clone().negate(),0,.22);
   const hit=ray.intersectObject(map,true).find(h=>h.object instanceof THREE.Mesh);if(!hit||hit.point.distanceTo(position)>.7)continue;
   position.copy(hit.point);if(hit.face){normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);if(normal.dot(ray.ray.direction)>0)normal.negate();}
   const rotation=sprayRotation(normal,spray.ray?.direction);
   const geometry=surfaceDecalGeometry(hit.object as THREE.Mesh,position,rotation,new THREE.Vector3(spray.size??1.15,spray.size??1.15,.10)),mesh=new THREE.Mesh(geometry,this.material);mesh.renderOrder=2;mesh.receiveShadow=true;this.scene.add(mesh);this.marks.set(spray.id,mesh);
  }
 }
 clear(){for(const mesh of this.marks.values()){mesh.removeFromParent();mesh.geometry.dispose();}this.marks.clear();}
 destroy(){this.clear();this.material.dispose();this.texture.dispose();}
}
