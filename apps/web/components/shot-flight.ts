import * as THREE from 'three';

/** Visual tracer: a fast streak on an immutable world-space path, not a beam
 * tethered to the weapon. Server hit detection remains instant hitscan. */
export class ShotFlight {
 readonly origin:THREE.Vector3;
 readonly target:THREE.Vector3;
 readonly direction:THREE.Vector3;
 readonly distance:number;
 readonly until:number;
 constructor(origin:THREE.Vector3,target:THREE.Vector3,readonly started:number){
  this.origin=origin.clone();this.target=target.clone();this.direction=target.clone().sub(origin);this.distance=this.direction.length();this.direction.normalize();
  this.until=started+Math.max(32,(this.distance+10)/900*1000);
 }
 write(geometry:THREE.BufferGeometry,now:number){
  const age=Math.max(0,now-this.started),head=Math.min(this.distance,Math.max(2,age*.9)),tail=Math.max(0,head-10);
  const points=geometry.attributes.position;
  points.setXYZ(0,this.origin.x+this.direction.x*tail,this.origin.y+this.direction.y*tail,this.origin.z+this.direction.z*tail);
  points.setXYZ(1,this.origin.x+this.direction.x*head,this.origin.y+this.direction.y*head,this.origin.z+this.direction.z*head);
  points.needsUpdate=true;geometry.computeBoundingSphere();
 }
}
