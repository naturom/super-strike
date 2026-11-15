const TAU=Math.PI*2;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(t:number)=>t*t*(3-2*t);
export type Gait={phase:number;weight:number;speed:number;run:number;x:number;z:number;cycleLength:number;stance:number};
/** Distance drives footfalls; filtered velocity controls the body and eases stops. */
export class Locomotion{
 private previous?:{x:number;z:number};private vx=0;private vz=0;
 readonly value:Gait={phase:0,weight:0,speed:0,run:0,x:0,z:-1,cycleLength:2.2,stance:.42};
 update(position:{x:number;z:number},yaw:number,dt:number,grounded:boolean,crouched=false,climbing=false){
  const last=this.previous;this.previous={x:position.x,z:position.z};dt=clamp(dt,0,.1);
  const dx=last?position.x-last.x:0,dz=last?position.z-last.z:0,distance=Math.hypot(dx,dz),g=this.value;
  const continuous=!!last&&dt>0&&distance<1.5,active=grounded&&!climbing;
  if(!continuous){this.vx=this.vz=0;g.weight=0;}
  const alpha=1-Math.exp(-dt*16),vx=continuous&&active?dx/dt:0,vz=continuous&&active?dz/dt:0;
  this.vx=mix(this.vx,vx,alpha);this.vz=mix(this.vz,vz,alpha);g.speed=Math.min(9,Math.hypot(this.vx,this.vz));
  g.weight=mix(g.weight,active?clamp(g.speed/.8):0,1-Math.exp(-dt*18));if(g.weight<.0001)g.weight=0;
  if(g.speed>.05){g.x=(Math.cos(yaw)*this.vx-Math.sin(yaw)*this.vz)/g.speed;g.z=(Math.sin(yaw)*this.vx+Math.cos(yaw)*this.vz)/g.speed;const len=Math.hypot(g.x,g.z);g.x/=len;g.z/=len;}
  g.run=crouched?0:ease(clamp((g.speed-4.5)/3.5));g.cycleLength=crouched?1.25:mix(2.2,3.1,g.run);g.stance=crouched?.66:mix(.42,.25,g.run);
  if(active&&continuous)g.phase=(g.phase+Math.min(distance/g.cycleLength,dt*3)*TAU)%TAU;
  return g;
 }
}
/** Linear support phase plants the foot; the return stroke lifts and rolls it. */
export function footfall(g:Gait,side:number,crouch=0){
 const cycle=((g.phase/TAU+side*.5)%1+1)%1,contact=cycle<g.stance,travel=g.cycleLength*g.stance;
 let along:number,lift=0,pitch:number;
 if(contact){
  const t=cycle/g.stance;along=travel*(.5-t);
  pitch=t<.18?.14*(1-ease(t/.18)):-mix(.16,.28,g.run)*ease(clamp((t-.72)/.28));
 }else{
  const t=(cycle-g.stance)/(1-g.stance);along=travel*(ease(t)-.5);
  lift=Math.pow(Math.sin(t*Math.PI),1.4)*mix(mix(.095,.19,g.run),.035,crouch);
  pitch=mix(-mix(.16,.28,g.run),.14,ease(t))+.12*Math.sin(t*Math.PI);
 }
 return {x:g.x*along,z:g.z*along,lift,pitch,contact};
}
export function firstPersonGait(g:Gait,reduced=false){
 const weight=reduced?0:g.weight;
 return {x:Math.sin(g.phase)*.006*weight,y:Math.cos(g.phase*2)*mix(.005,.009,g.run)*weight,z:-.012*g.run*weight,roll:-g.x*.006*weight};
}
