import * as THREE from 'three';
import type {WorldArt} from './world';

/** One flower rooted at the real muzzle socket, shared by both weapon views. */
export function updateWeaponFlower(model:THREE.Object3D,shown:boolean,now:number,art:WorldArt){
 let flower=model.getObjectByName('muzzle-flower') as THREE.Group|undefined;
 if(!shown){if(flower){flower.visible=false;flower.userData.started=undefined;}return;}
 const muzzle=model.getObjectByName('muzzle');if(!muzzle)return;
 if(!flower){
  flower=new THREE.Group();flower.name='muzzle-flower';
  const green=art.material('#397d34',{roughness:.8}),pink=art.material('#ed527e',{roughness:.62}),gold=art.material('#ffcf42',{roughness:.85});
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.005,.007,.23,8),green);stem.rotation.x=Math.PI/2;stem.position.z=-.115;flower.add(stem);
  for(const side of [-1,1]){
   const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),green);leaf.scale.set(.035,.012,.017);leaf.position.set(side*.025,side*.012,-.10);leaf.rotation.z=side*.5;flower.add(leaf);
  }
  for(let petal=0;petal<9;petal++){
   const angle=petal*Math.PI*2/9,piece=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),pink);
   piece.scale.set(.036,.065,.014);piece.position.set(Math.cos(angle)*.059,Math.sin(angle)*.059,-.235);piece.rotation.z=angle-Math.PI/2;flower.add(piece);
  }
  const center=new THREE.Mesh(new THREE.SphereGeometry(.029,14,10),gold);center.scale.z=.48;center.position.z=-.215;flower.add(center);
  flower.traverse(o=>{o.layers.mask=muzzle.layers.mask;if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});muzzle.add(flower);
 }
 if(!flower.visible||flower.userData.started===undefined)flower.userData.started=now;
 flower.visible=true;
 const t=Math.min(1,Math.max(0,(now-flower.userData.started)/420));
 const pop=1-Math.pow(1-t,3)+Math.sin(t*Math.PI*2)*.12*(1-t);
 flower.scale.setScalar(Math.max(.001,pop));
}
