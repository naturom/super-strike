import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Pickup,Weapon} from '@sirocco/shared';
import {disposeGroup,type WorldArt} from './world';

type Template={parts:{geometry:THREE.BufferGeometry;material:THREE.Material}[];lift:number};
/** Static, instanced ground pickups stay cheap even after a busy firefight. */
export class GroundWeapons{
 readonly root=new THREE.Group();
 private templates=new Map<Weapon,Template>();private batches:THREE.InstancedMesh[]=[];private signature='';
 constructor(private art:WorldArt,scene:THREE.Scene){this.root.name='Dropped weapons';scene.add(this.root);}
 private template(weapon:Weapon){
  let template=this.templates.get(weapon);if(template)return template;
  const model=this.art.weapon(weapon,false);model.rotation.z=Math.PI/2;model.updateMatrixWorld(true);
  const lift=-new THREE.Box3().setFromObject(model).min.y*.8+.025,groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
  model.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld),pieces=groups.get(o.material)??[];pieces.push(geometry);groups.set(o.material,pieces);});
  const parts:Template['parts']=[];for(const [material,pieces] of groups){const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();if(geometry)parts.push({geometry,material});}disposeGroup(model);
  template={parts,lift};this.templates.set(weapon,template);return template;
 }
 sync(pickups:readonly Pickup[]){
  const dropped=pickups.filter(p=>p.dropped),signature=dropped.map(p=>p.id).join('|');if(signature===this.signature)return;
  this.clear();this.signature=signature;const byWeapon=new Map<Weapon,Pickup[]>();for(const p of dropped){const list=byWeapon.get(p.weapon)??[];list.push(p);byWeapon.set(p.weapon,list);}
  const transform=new THREE.Object3D();
  for(const [weapon,list] of byWeapon){const template=this.template(weapon);for(const part of template.parts){
   const mesh=new THREE.InstancedMesh(part.geometry,part.material,list.length);mesh.name=`Dropped ${weapon}`;mesh.castShadow=mesh.receiveShadow=true;
   list.forEach((p,i)=>{transform.position.set(p.x,p.y+template.lift,p.z);transform.rotation.set(0,p.yaw??0,0);transform.scale.setScalar(.8);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);this.batches.push(mesh);
  }}
 }
 clear(){for(const mesh of this.batches){mesh.removeFromParent();mesh.dispose();}this.batches=[];this.signature='';}
 destroy(){this.clear();for(const template of this.templates.values())for(const part of template.parts)part.geometry.dispose();this.templates.clear();this.root.removeFromParent();}
}
