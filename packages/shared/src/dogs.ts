import type {Vec3,Team,HitZone} from './index';
export const DOG_RULES={hp:35,radius:.24,height:.95,speed:6.2,sight:40,biteRange:1.2,biteDamage:5,biteInterval:1400,windup:250,biteLimit:3,lifetimeMs:22000,corpseMs:2200} as const;
export interface Dog extends Vec3 {id:string;owner:string;team:Team;yaw:number;hp:number;state:'follow'|'hunt'|'attack'|'dead';targetId:string|null;attackAt:number;deadAt:number;expiresAt:number;}
export function rayDog(origin:Vec3,direction:Vec3,dog:Dog):{distance:number;zone:HitZone}|null{
 const c=Math.cos(dog.yaw),s=Math.sin(dog.yaw),dx=origin.x-dog.x,dz=origin.z-dog.z,o=[c*dx-s*dz,origin.y-dog.y,s*dx+c*dz],d=[c*direction.x-s*direction.z,direction.y,s*direction.x+c*direction.z];let best:{distance:number;zone:HitZone}|null=null;
 for(const v of [{center:[0,.43,.02],radius:[.20,.24,.46],zone:'body' as const},{center:[0,.64,-.47],radius:[.19,.22,.30],zone:'head' as const}]){
  let a=0,b=0,k=-1;for(let i=0;i<3;i++){const p=(o[i]-v.center[i])/v.radius[i],t=d[i]/v.radius[i];a+=t*t;b+=2*p*t;k+=p*p;}
  const disc=b*b-4*a*k;if(a<=0||disc<0)continue;const near=(-b-Math.sqrt(disc))/(2*a),far=(-b+Math.sqrt(disc))/(2*a);if(far<0)continue;const distance=Math.max(0,near);if(!best||distance<best.distance)best={distance,zone:v.zone};
 }
 return best;
}
