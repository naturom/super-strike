import {DT,DOG_RULES,heightOf,wallDistance,type Dog,type Player,type MapDefinition,type Solid,type Vec3} from '@sirocco/shared';
import {TrexNavigation,type NavigationSearch} from './trex-navigation';
type Brain={search?:NavigationSearch;route:Vec3[];repathAt:number;attackReady:number;struck:boolean;bites:number;};
export class DogSimulation{
 dogs:Dog[]=[];private used=new Set<string>();private brains=new Map<string,Brain>();private serial=0;private navigation?:TrexNavigation;
 constructor(private map:MapDefinition,private solids:()=>Solid[]){}
 private nav(){const solids=this.solids();if(this.navigation?.solids!==solids)this.navigation=new TrexNavigation(solids,this.map,{radius:DOG_RULES.radius,height:DOG_RULES.height,cell:.8,maxStep:.4});return this.navigation!;}
 clear(){this.navigation?.clearWork();this.dogs=[];this.used.clear();this.brains.clear();}
 removeOwner(id:string){this.dogs=this.dogs.filter(d=>{if(d.owner!==id)return true;this.navigation?.cancel(this.brains.get(d.id)?.search);this.brains.delete(d.id);return false;});this.used.delete(id);}
 deploy(owner:Player,time:number,players:Player[]){
  if(owner.hp<=0||!owner.connected||this.used.has(owner.id))return;const nav=this.nav();let point:Vec3|undefined;
  for(const distance of [1.4,2,2.8,3.5]){for(const angle of [0,.5,-.5,1,-1,Math.PI]){
   const yaw=owner.yaw+angle,p=nav.point(owner.x-Math.sin(yaw)*distance,owner.z-Math.cos(yaw)*distance);
   if(!p||Math.abs(p.y-owner.y)>.5||players.some(other=>other.hp>0&&Math.hypot(other.x-p.x,other.z-p.z)<.65)||this.dogs.some(d=>d.hp>0&&Math.hypot(d.x-p.x,d.z-p.z)<.6))continue;
   const from={x:owner.x,y:owner.y+.5,z:owner.z},dx=p.x-from.x,dy=p.y+.4-from.y,dz=p.z-from.z,len=Math.hypot(dx,dy,dz);
   if(wallDistance(from,{x:dx/len,y:dy/len,z:dz/len},this.solids())>=len-.05){point=p;break;}
  }if(point)break;}
  if(!point)return;
  const dog:Dog={id:`dog-${++this.serial}`,owner:owner.id,team:owner.team,...point,yaw:owner.yaw,hp:DOG_RULES.hp,state:'follow',targetId:null,attackAt:0,deadAt:0,expiresAt:time+DOG_RULES.lifetimeMs};
  this.dogs.push(dog);this.used.add(owner.id);owner.dogUsed=true;owner.protectedUntil=0;this.brains.set(dog.id,{route:[],repathAt:0,attackReady:time+700,struck:false,bites:0});return dog;
 }
 canBite(dog:Dog,p:Player){
  if(p.team===dog.team||p.hp<=0||!p.connected||Math.hypot(p.x-dog.x,p.z-dog.z)>DOG_RULES.biteRange||Math.abs(p.y-dog.y)>.8)return false;
  const from={x:dog.x,y:dog.y+.55,z:dog.z},d={x:p.x-from.x,y:p.y+Math.min(.75,heightOf(p)/2)-from.y,z:p.z-from.z},len=Math.hypot(d.x,d.y,d.z);
  return len<.01||wallDistance(from,{x:d.x/len,y:d.y/len,z:d.z/len},this.solids())>=len-.05;
 }
 step(time:number,players:Player[],bite:(p:Player,dog:Dog)=>void,bark:(dog:Dog)=>void){
  this.dogs=this.dogs.filter(d=>{if(time<d.expiresAt&&(d.hp>0||time-d.deadAt<DOG_RULES.corpseMs))return true;this.navigation?.cancel(this.brains.get(d.id)?.search);this.brains.delete(d.id);return false;});
  if(!this.dogs.some(d=>d.hp>0))return;const nav=this.nav();
  for(const dog of this.dogs){const brain=this.brains.get(dog.id)!;if(dog.hp<=0){nav.cancel(brain.search);brain.search=undefined;continue;}if(brain.search?.done){brain.route=brain.search.route;brain.search=undefined;brain.repathAt=Math.max(brain.repathAt,time+300);}
   if(dog.state==='attack'&&time<dog.attackAt+600){
    if(!brain.struck&&time>=dog.attackAt+DOG_RULES.windup){brain.struck=true;const victim=players.find(p=>p.id===dog.targetId);if(victim&&this.canBite(dog,victim)){bite(victim,dog);brain.bites++;if(brain.bites>=DOG_RULES.biteLimit)dog.expiresAt=Math.min(dog.expiresAt,time+450);}}
    continue;
   }
   const target=players.filter(p=>p.team!==dog.team&&p.hp>0&&p.connected&&Math.abs(p.y-dog.y)<1.2&&Math.hypot(p.x-dog.x,p.z-dog.z)<DOG_RULES.sight).sort((a,b)=>Math.hypot(a.x-dog.x,a.z-dog.z)-Math.hypot(b.x-dog.x,b.z-dog.z))[0];
   if(dog.targetId!==target?.id){nav.cancel(brain.search);brain.search=undefined;brain.repathAt=0;brain.route=[];dog.targetId=target?.id??null;}dog.state=target?'hunt':'follow';
   if(target&&this.canBite(dog,target)){
    const yaw=Math.atan2(dog.x-target.x,dog.z-target.z);dog.yaw=this.turn(dog.yaw,yaw,DT*9);
    if(time>=brain.attackReady){dog.state='attack';dog.attackAt=time;brain.attackReady=time+DOG_RULES.biteInterval;brain.struck=false;bark(dog);}continue;
   }
   const owner=players.find(p=>p.id===dog.owner&&p.hp>0&&p.connected),goal=target??owner;if(!goal){brain.route=[];continue;}
   if(!target&&Math.hypot(goal.x-dog.x,goal.z-dog.z)<2.2){brain.route=[];continue;}
   if(time>=brain.repathAt&&!brain.search){brain.repathAt=time+900;if(nav.clear(dog,goal))brain.route=[{x:goal.x,y:goal.y,z:goal.z}];else brain.search=nav.request(dog,goal);}
   while(brain.route.length&&Math.hypot(brain.route[0].x-dog.x,brain.route[0].z-dog.z)<.22)brain.route.shift();const next=brain.route[0];if(!next)continue;
   const dx=next.x-dog.x,dz=next.z-dog.z,len=Math.hypot(dx,dz),distance=Math.min(len,DOG_RULES.speed*(target?1:.7)*DT),point=nav.point(dog.x+dx/len*distance,dog.z+dz/len*distance);dog.yaw=this.turn(dog.yaw,Math.atan2(-dx,-dz),DT*8);
   if(point&&Math.abs(point.y-dog.y)<=.4&&!this.dogs.some(other=>other!==dog&&other.hp>0&&Math.hypot(other.x-point.x,other.z-point.z)<DOG_RULES.radius*2))Object.assign(dog,point);else{brain.route=[];brain.repathAt=time+200;}
  }
  nav.work(time);
 }
 private turn(a:number,b:number,step:number){const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+Math.max(-step,Math.min(step,d));}
}
