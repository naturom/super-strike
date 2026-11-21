import * as THREE from 'three';

/** Lobby-only cutaway; the same cached world restores its complete shell on entry. */
export function setCaveCutaway(root:THREE.Group,enabled:boolean){
 if(!root.userData.caveStats||root.userData.caveCutaway===enabled)return false;
 root.userData.caveCutaway=enabled;
 const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),2.4);
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(materials.some(m=>m.userData.caveRoof))object.visible=!enabled;
  for(const material of materials)if(material.userData.caveSection){material.clippingPlanes=enabled?[plane]:null;material.clipShadows=true;material.needsUpdate=true;}
 });
 return true;
}
