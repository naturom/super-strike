import {DT,intersects,type Input,type Motion,type Solid} from './index';

export interface Ladder {
 id:string;label:string;side:'outside'|'inside';x:number;z:number;bottom:number;top:number;width:number;
 /** Points away from the wall toward the climber. */
 normal:{x:number;z:number};
}

export function nearbyLadder(p:Motion,ladders:readonly Ladder[]){
 return ladders.find(l=>{
  const dx=p.x-l.x,dz=p.z-l.z,depth=dx*l.normal.x+dz*l.normal.z,lateral=dx*l.normal.z-dz*l.normal.x;
  return Math.abs(depth)<=.38&&Math.abs(lateral)<=l.width/2+.08&&p.y>=l.bottom-.25&&p.y<=l.top+.15;
 });
}

/** Shared by client prediction and server movement. No client-supplied climb state. */
export function climbLadder(p:Motion,i:Input,solids:Solid[],ladders:readonly Ladder[]):Motion|undefined {
 const ladder=nearbyLadder(p,ladders);if(!ladder)return;
 const n=ladder.normal,continuing=p.climbing===ladder.id;
 if(i.jump){
  if(!continuing)return;
  const detached={...p,x:p.x+n.x*.5,z:p.z+n.z*.5,vy:4.5,grounded:false,climbing:undefined};
  return solids.some(b=>intersects(detached,b))?undefined:detached;
 }
 const norm=Math.max(1,Math.hypot(i.forward,i.strafe));
 const dx=(-Math.sin(i.yaw)*i.forward+Math.cos(i.yaw)*i.strafe)/norm,dz=(-Math.cos(i.yaw)*i.forward-Math.sin(i.yaw)*i.strafe)/norm;
 const toward=-(dx*n.x+dz*n.z),vertical=Math.abs(toward)>.15?toward:0;
 if(!continuing&&!vertical)return;
 // Walk off the top toward the wall, or off the bottom away from it.
 if(vertical>0&&p.y>=ladder.top-.001||vertical<0&&p.y<=ladder.bottom+.001)return;
 const depth=(p.x-ladder.x)*n.x+(p.z-ladder.z)*n.z,align=Math.max(-.1,Math.min(.1,-depth));
 const lateral=(dx*n.z-dz*n.x)*2*DT;
 const out:Motion={...p,x:p.x+n.x*align+n.z*lateral,z:p.z+n.z*align-n.x*lateral,y:Math.max(ladder.bottom,Math.min(ladder.top,p.y+vertical*3*DT)),vy:0,grounded:true,climbing:ladder.id};
 // Never climb through masonry, an overhang or a landing guard.
 if(solids.some(b=>intersects(out,b,out.crouched?1.1:1.8)))return;
 return out;
}
