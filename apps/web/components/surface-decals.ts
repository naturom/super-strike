import * as THREE from 'three';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {nearbyTriangles} from './static-mesh-index';

/** Crop a batched world mesh before clipping a tiny decal. This avoids creating
 * thousands of temporary decal vertices for the rest of an entire building. */
export function surfaceDecalGeometry(mesh:THREE.Mesh,point:THREE.Vector3,rotation:THREE.Euler,size:THREE.Vector3,facing?:THREE.Vector3){
 const source=mesh.geometry,p=source.attributes.position,n=source.attributes.normal,index=source.index;
 const local=point.clone().applyMatrix4(mesh.matrixWorld.clone().invert()),scale=new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld),radius=size.length()/2/Math.max(.0001,Math.min(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z)));
 const positions:number[]=[],normals:number[]=[],normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),aPoint=new THREE.Vector3(),bPoint=new THREE.Vector3(),cPoint=new THREE.Vector3();
 for(const triangle of nearbyTriangles(mesh,local,radius)){const i=triangle*3;
  const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
  if(Math.max(p.getX(a),p.getX(b),p.getX(c))<local.x-radius||Math.min(p.getX(a),p.getX(b),p.getX(c))>local.x+radius||Math.max(p.getY(a),p.getY(b),p.getY(c))<local.y-radius||Math.min(p.getY(a),p.getY(b),p.getY(c))>local.y+radius||Math.max(p.getZ(a),p.getZ(b),p.getZ(c))<local.z-radius||Math.min(p.getZ(a),p.getZ(b),p.getZ(c))>local.z+radius)continue;
  if(facing){aPoint.fromBufferAttribute(p,a);bPoint.fromBufferAttribute(p,b).sub(aPoint);cPoint.fromBufferAttribute(p,c).sub(aPoint);if(bPoint.cross(cPoint).applyMatrix3(normalMatrix).normalize().dot(facing)<.2)continue;}
  for(let j=0;j<3;j++){const id=j===0?a:j===1?b:c;positions.push(p.getX(id),p.getY(id),p.getZ(id));if(n)normals.push(n.getX(id),n.getY(id),n.getZ(id));}
 }
 const cropped=new THREE.BufferGeometry();cropped.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 if(n)cropped.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else cropped.computeVertexNormals();
 const target=new THREE.Mesh(cropped);target.matrixWorld.copy(mesh.matrixWorld);
 const decal=new DecalGeometry(target,point,rotation,size);cropped.dispose();return decal;
}

/** Cosmetic transparent layers are not the receiving surface beneath the paint. */
export function spraySurface(object:THREE.Object3D):object is THREE.Mesh{
 if(!(object instanceof THREE.Mesh))return false;
 const materials=Array.isArray(object.material)?object.material:[object.material];
 return object.visible&&materials.every(m=>m.visible&&!m.transparent&&!m.userData.noRaycast);
}

/** A wall can span several material batches. Project onto every nearby facing
 * surface, keeping one artwork coordinate system across their shared seams. */
export function spraySurfaceGeometry(map:THREE.Object3D,point:THREE.Vector3,rotation:THREE.Euler,size:THREE.Vector3){
 const facing=new THREE.Vector3(0,0,1).applyEuler(rotation),radius=size.length()/2,area=new THREE.Box3().setFromCenterAndSize(point,new THREE.Vector3(radius*2,radius*2,radius*2)),bounds=new THREE.Box3(),parts:THREE.BufferGeometry[]=[];
 map.traverseVisible(object=>{
  if(!spraySurface(object))return;
  if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
  bounds.copy(object.geometry.boundingBox!).applyMatrix4(object.matrixWorld);if(!bounds.intersectsBox(area))return;
  const part=surfaceDecalGeometry(object,point,rotation,size,facing);if(part.attributes.position.count)parts.push(part);else part.dispose();
 });
 const geometry=parts.length?mergeGeometries(parts)!:new THREE.BufferGeometry();for(const part of parts)part.dispose();return geometry;
}
