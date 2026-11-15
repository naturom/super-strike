import * as THREE from 'three';

type FallenLog={x:number;z:number;length:number;axis:'x'|'z'};
/** The bark is open-ended. Each exposed end has exactly one matching wood face. */
export function islandLog(log:FallenLog,bark:THREE.Material,cutWood:THREE.Material){
 const root=new THREE.Group();root.name='Fallen log';
 const axis=new THREE.Vector3(log.axis==='x'?1:0,0,log.axis==='z'?1:0),orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.39,.425,log.length,12,1,true),bark);body.name='Log bark';body.quaternion.copy(orientation);body.castShadow=body.receiveShadow=true;root.add(body);
 for(const side of [-1,1]){
  const end=new THREE.Mesh(new THREE.CircleGeometry(side<0?.425:.39,12),cutWood);end.name='Log cut end';end.position.copy(axis).multiplyScalar(side*log.length/2);end.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis.clone().multiplyScalar(side));end.castShadow=end.receiveShadow=true;root.add(end);
 }
 root.position.set(log.x,.425,log.z);return root;
}
