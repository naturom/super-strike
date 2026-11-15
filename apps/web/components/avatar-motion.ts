import * as THREE from 'three';
import {poseWonderWomanSkirt} from './wonder-woman-skirt';
import type {Equipment} from '@sirocco/shared';
import {animateHands,type HeldPose} from './held-equipment';
import {poseAvatarBody} from './avatar-body-pose';
import {Locomotion} from './locomotion';
import {StanceMotion} from './stance-motion';

type MotionState={gait:Locomotion;stance:StanceMotion};
const motions=new WeakMap<THREE.Group,MotionState>();
export function resetAvatarMotion(model:THREE.Group){motions.delete(model);}
/** Animate the actual world body before any camera (including a mirror) renders it. */
export function animateAvatarMotion(model:THREE.Group,kind:Equipment,pose:HeldPose,dt:number,grounded:boolean,pitch=0,movement:{crouched?:boolean;vy?:number;climbing?:string}={}){
 let motion=motions.get(model);if(!motion){motion={gait:new Locomotion(),stance:new StanceMotion()};motions.set(model,motion);}
 const gait=motion.gait.update(model.position,model.rotation.y,dt,grounded,!!movement.crouched,!!movement.climbing);
 const stance=motion.stance.update(dt,grounded,!!movement.crouched,movement.vy??0),{lean,roll,twist}=poseAvatarBody(model,stance,gait.phase,gait.weight,gait);
 poseWonderWomanSkirt(model);
 const held=model.getObjectByName('equippedWeapon') as THREE.Group|undefined;if(!held)return;
 const rest=held.userData.restPosition as THREE.Vector3,rotation=held.userData.restQuaternion as THREE.Quaternion;
 if(rest&&rotation){
  const sway=pose.reduceMotion?0:gait.weight,offset=held.userData.motionOffset??=new THREE.Vector3(),turn=held.userData.motionRotation??=new THREE.Quaternion();
  offset.set(0,.16*stance.crouch+.025*stance.landing+Math.sin(gait.phase*2)*.005*sway,-.015*stance.crouch);
  turn.setFromEuler(new THREE.Euler(THREE.MathUtils.clamp(pitch,-.8,.8)*.55-lean,-twist*.8,-roll*.75+Math.sin(gait.phase)*.006*sway));
 }
 animateHands(held,kind,pose);
 // Reflector renders from onBeforeRender, so no stale arm matrices reach its camera.
 model.updateWorldMatrix(true,true);
}
