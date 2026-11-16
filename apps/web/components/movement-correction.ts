import {heightOf,intersects,movementSolids,RADIUS,type Motion,type Solid} from '@sirocco/shared';

/** Render-only reconciliation. Never changes the authoritative or predicted motion. */
export class MovementCorrection {
 private x=0;private z=0;
 reset(){this.x=this.z=0;}
 reconcile(before:Motion,after:Motion,reset=false){
  const dx=before.x-after.x,dz=before.z-after.z;
  if(reset||Math.hypot(dx,dz)>3||Math.abs(before.y-after.y)>.75){this.reset();return;}
  this.x+=dx;this.z+=dz;
  if(Math.hypot(this.x,this.z)>3)this.reset();
 }
 advance(dt:number){
  const distance=Math.hypot(this.x,this.z);if(distance<.0001){this.reset();return;}
  // Bound correction speed below normal movement speed: a small correction
  // should slow forward travel briefly rather than visibly reverse it.
  const amount=Math.min(distance*(1-Math.exp(-dt/.12)),2.5*dt),scale=1-amount/distance;
  this.x*=scale;this.z*=scale;
 }
 position(p:Motion,solids:Solid[]){
  const distance=Math.hypot(this.x,this.z);if(distance<.0001)return p;
  const nearby=movementSolids(solids,p.x,p.z,distance+RADIUS),steps=Math.ceil(distance/.1),height=heightOf(p);
  // Do not smooth a correction through trunks, walls or a corner.
  for(let i=1;i<=steps;i++)if(nearby.some(b=>intersects({...p,x:p.x+this.x*i/steps,z:p.z+this.z*i/steps},b,height))){this.reset();return p;}
  return {...p,x:p.x+this.x,z:p.z+this.z};
 }
}
