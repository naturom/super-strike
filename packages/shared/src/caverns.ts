import type {MapDefinition,Pickup,Solid,Weapon} from './index';

type Point=[number,number];
export const CAVE_ROUTES:Point[][]=[
 [[-35,0],[-24,-3],[-13,2],[0,0],[13,-2],[24,4],[35,0]],
 [[-32,-5],[-25,-17],[-10,-22],[6,-19],[24,-16],[32,-5]],
 [[-32,5],[-23,18],[-9,22],[7,20],[23,17],[32,5]],
 [[0,6],[2,13],[2,20]],
];
const ease=(a:number,b:number,t:number)=>{const n=Math.max(0,Math.min(1,(t-a)/(b-a)));return n*n*(3-2*n);};
function segmentDistance(x:number,z:number,a:Point,b:Point){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
/** Positive inside the linked chambers; the small continuous perturbation breaks up straight walls. */
export function caveField(x:number,z:number){
 let inside=-Infinity;
 for(const [index,path] of CAVE_ROUTES.entries())for(let i=1;i<path.length;i++)inside=Math.max(inside,(index===2?4.6:index===3?3.7:4.1)-segmentDistance(x,z,path[i-1],path[i]));
 for(const [cx,cz,rx,rz] of [[-35,0,10,10],[35,0,10,10],[0,0,12,10],[-9,22,9,6.5],[8,-19,8,6]])inside=Math.max(inside,(1-Math.hypot((x-cx)/rx,(z-cz)/rz))*Math.min(rx,rz));
 return inside+.38*Math.sin(x*.63+z*.34)+.23*Math.sin(z*.91-x*.28);
}
export const CAVE_WATER={level:-.5,bed:-3.35} as const;
export function caveFloor(x:number,z:number){
 const wet=ease(7,18,z)*(1-ease(17,32,Math.abs(x)));
 return -3.35*wet;
}
export function caveCeiling(x:number,z:number){
 const dome=5.8+2.5*Math.exp(-(x*x+z*z)/140)+.6*Math.sin(x*.19)*Math.cos(z*.27)+.25*Math.sin(x*.71+z*.42);
 // A short submerged siphon joins two open pools. Both ends rise gradually back to dry routes.
 const siphon=ease(16,20,z)*(1-ease(5,11,Math.abs(x)));
 return dome*(1-siphon)+(caveFloor(x,z)+2.75)*siphon;
}
export interface CavePatch {points:Point[];floor:number[];ceiling:number[];}
export interface CaveEdge {a:Point;b:Point;}
export const CAVE_PATCHES:CavePatch[]=[],CAVE_EDGES:CaveEdge[]=[],CAVE_ARCHES:CavePatch[]=[],CAVE_ROOTS:CavePatch[]=[],CAVE_COLUMNS:Solid[]=[];
const solids:Solid[]=[];
function prism(label:string,polygon:Point[],bottom:number,top:number,kind:Solid['kind']){
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const b:Solid={label,polygon,x:(minX+maxX)/2,z:(minZ+maxZ)/2,w:maxX-minX,d:maxZ-minZ,y:(bottom+top)/2,h:top-bottom,kind,style:'stone'};solids.push(b);return b;
}
function plane(points:Point[],heights:number[]){const [a,b,c]=points,[h,j,k]=heights,dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-a[0],ez=c[1]-a[1],det=dx*ez-ex*dz,x=((j-h)*ez-(k-h)*dz)/det,z=(dx*(k-h)-ex*(j-h))/det;return{x,z,offset:h-x*a[0]-z*a[1]};}
function clip(triangle:Point[]){const polygon:Point[]=[];for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],fa=caveField(...a),fb=caveField(...b);if(fa>=0)polygon.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);polygon.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return polygon;}
// A shared triangulation supplies collision, rendering and water. No stacked floor slabs or hidden seams.
const boundary=new Map<string,{a:Point;b:Point;count:number}>(),key=(p:Point)=>p.map(v=>v.toFixed(6)).join(',');
for(let x=-48;x<48;x+=3)for(let z=-30;z<30;z+=3){
 const a:Point=[x,z],b:Point=[x+3,z],c:Point=[x+3,z+3],d:Point=[x,z+3];
 for(const triangle of [[a,b,c],[a,c,d]]){
  const polygon=clip(triangle);if(polygon.length<3)continue;
  for(let i=1;i<polygon.length-1;i++){
   const points=[polygon[0],polygon[i],polygon[i+1]],area=Math.abs((points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[2][0]-points[0][0])*(points[1][1]-points[0][1]));if(area<1e-7)continue;
   const floor=points.map(p=>caveFloor(...p)),ceiling=points.map(p=>caveCeiling(...p)),patch={points,floor,ceiling};CAVE_PATCHES.push(patch);
   const solid=prism('Cave bedrock',points,-5,Math.max(...floor),'floor');solid.topPlane=plane(points,floor);
   prism('Cave ceiling',points,Math.min(...ceiling),11,'roof').bottomPlane=plane(points,ceiling);
   for(let edge=0;edge<3;edge++){const a=points[edge],b=points[(edge+1)%3],id=[key(a),key(b)].sort().join('|'),old=boundary.get(id);if(old)old.count++;else boundary.set(id,{a,b,count:1});}
  }
 }
}
for(const {a,b,count} of boundary.values())if(count===1){
 CAVE_EDGES.push({a,b});const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=dz/length*.8,nz=-dx/length*.8;
 // Polygons are counterclockwise in x/z, so the right-hand strip is outside the playable volume.
 prism('Cave wall',[a,b,[b[0]+nx,b[1]+nz],[a[0]+nx,a[1]+nz]],-5,11,'wall');
 const archWidth=1.1,ia:Point=[a[0]-nx/.8*archWidth,a[1]-nz/.8*archWidth],ib:Point=[b[0]-nx/.8*archWidth,b[1]-nz/.8*archWidth];
 const low=(p:Point)=>Math.max(caveFloor(...p)+3.05,caveCeiling(...p)-1.6);
 if(Math.min(caveCeiling(...a)-caveFloor(...a),caveCeiling(...b)-caveFloor(...b))>4.7)for(const [points,heights] of [[[a,b,ib],[low(a),low(b),caveCeiling(...ib)]],[[a,ib,ia],[low(a),caveCeiling(...ib),caveCeiling(...ia)]]] as [Point[],number[]][]){
  prism('Arched cave shoulder',points,Math.min(...heights),11,'roof').bottomPlane=plane(points,heights);CAVE_ARCHES.push({points,floor:heights,ceiling:heights});
 }
}
for(const [x,z,r] of [[0,0,2.1],[-17,-1,1.05],[17,1,1.2],[9,-23,1.05],[-10,23,1.1]]){
 const polygon:Point[]=Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9,reach=r*(1+.12*Math.sin(i*4.1+x));return[x+Math.cos(a)*reach,z+Math.sin(a)*reach];});
 CAVE_COLUMNS.push(prism('Limestone column',polygon,caveFloor(x,z),caveCeiling(x,z),'wall'));
 // Flowstone fans join each column into the floor and vault, rather than ending like cut masonry.
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],outer=(p:Point,scale:number):Point=>[x+(p[0]-x)*scale,z+(p[1]-z)*scale],ra=outer(a,1+.8/r),rb=outer(b,1+.8/r),ca=outer(a,1+1.6/r),cb=outer(b,1+1.6/r);
  for(const [points,heights] of [[[a,b,rb],[caveFloor(...a)+.85,caveFloor(...b)+.85,caveFloor(...rb)]],[[a,rb,ra],[caveFloor(...a)+.85,caveFloor(...rb),caveFloor(...ra)]]] as [Point[],number[]][]){const root=prism('Flowstone root',points,Math.min(...heights)-.15,Math.max(...heights),'wall');root.topPlane=plane(points,heights);CAVE_ROOTS.push({points,floor:heights,ceiling:heights});}
  const neck=(p:Point)=>Math.max(caveFloor(...p)+3.1,caveCeiling(...p)-2.5);
  for(const [points,heights] of [[[a,b,cb],[neck(a),neck(b),caveCeiling(...cb)]],[[a,cb,ca],[neck(a),caveCeiling(...cb),caveCeiling(...ca)]]] as [Point[],number[]][]){prism('Flowstone vault',points,Math.min(...heights),11,'roof').bottomPlane=plane(points,heights);CAVE_ARCHES.push({points,floor:heights,ceiling:heights});}
 }
}
const pickups:Pickup[]=[];
for(const side of [-1,1])(['ak47','m4a1s','p90','scar','marksman','m249','smg','deagle'] as Weapon[]).forEach((weapon,i)=>pickups.push({id:`cave-${side}-${weapon}`,weapon,base:side<0?'red':'blue',x:side*(31.5+(i%4)*2.8),y:0,z:-6+Math.floor(i/4)*12,availableAt:0}));
export const CAVERNS:MapDefinition={
 id:'caverns',name:'Sunken Caverns',subtitle:'Rock chambers · Dry tunnels · Flooded passages',
 description:'A natural limestone cave network. Fight through vaulted chambers, circle a dry upper passage, or descend into a submerged tunnel and emerge behind the enemy.',
 solids,pickups,water:CAVE_WATER,bounds:{minX:-47,maxX:47,minZ:-29,maxZ:30},spawnYaw:{red:-Math.PI/2,blue:Math.PI/2},
 spawns:{red:[{x:-39,y:0,z:-2},{x:-39,y:0,z:2},{x:-36,y:0,z:-2},{x:-36,y:0,z:2}],blue:[{x:39,y:0,z:2},{x:39,y:0,z:-2},{x:36,y:0,z:2},{x:36,y:0,z:-2}]},
 bombSites:[{id:'A',x:35,z:0,w:6,d:6,minY:-.02,maxY:.15,marker:{x:35,y:0,z:0,size:6}},{id:'B',x:-35,z:0,w:6,d:6,minY:-.02,maxY:.15,marker:{x:-35,y:0,z:0,size:6}}],
 landmarks:[{name:'WEST GROTTO',x:-35,z:0},{name:'EAST GROTTO',x:35,z:0},{name:'CATHEDRAL',x:0,z:0},{name:'DRY GALLERY',x:0,z:-20},{name:'SUNKEN PASSAGE',x:0,z:21},{name:'WEST POOL',x:-20,z:17},{name:'EAST POOL',x:20,z:17},{name:'A',x:35,z:0},{name:'B',x:-35,z:0}],
};
