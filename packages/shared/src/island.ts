import type {MapDefinition,Pickup,Solid,Vec3,Weapon} from './index';
export const ISLAND_SIZE={x:54,z:44} as const;
export const ISLAND_PATHS:[number,number][][]=[
 [[-36,18],[-22,13],[-10,9],[0,11],[13,5],[24,-9],[36,-18]],
 [[-36,18],[-30,0],[-24,-18],[-3,-27],[23,-24],[36,-18]],
 [[-36,18],[-20,29],[1,29],[24,18],[36,-18]],
];
export function islandPathDistance(p:{x:number;z:number}){let best=Infinity;for(const path of ISLAND_PATHS)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz));}return best;}
export function islandCoast(angle:number){return 1+.035*Math.sin(angle*3+.6)+.028*Math.sin(angle*7-1.1);}
export function islandRadius(x:number,z:number){const angle=Math.atan2(z/ISLAND_SIZE.z,x/ISLAND_SIZE.x);return Math.hypot(x/ISLAND_SIZE.x,z/ISLAND_SIZE.z)/islandCoast(angle);}
export const ISLAND_COAST:[number,number][]=Array.from({length:64},(_,i)=>{const a=i*Math.PI*2/64,r=islandCoast(a);return [Math.cos(a)*ISLAND_SIZE.x*r,Math.sin(a)*ISLAND_SIZE.z*r];});
let seed=41679;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const solids:Solid[]=[];
function prism(label:string,polygon:[number,number][],height:number,style:Solid['style']='stone',base=0,kind:Solid['kind']='wall'){
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const solid:Solid={label,polygon,x:(minX+maxX)/2,z:(minZ+maxZ)/2,w:maxX-minX,d:maxZ-minZ,y:base+height/2,h:height,kind,style};solids.push(solid);return solid;
}
prism('Island ground',ISLAND_COAST,.4,'earth',-.4,'floor');
// Only player movement stops at deep water. Shots and paint never hit an invisible wall.
for(let i=0;i<ISLAND_COAST.length;i++){const a=ISLAND_COAST[i],b=ISLAND_COAST[(i+1)%ISLAND_COAST.length];prism('Deep water',[a,b,[b[0]*1.24,b[1]*1.24],[a[0]*1.24,a[1]*1.24]],12,'water',-1);}
export interface IslandTree extends Vec3 {radius:number;height:number;kind:'canopy'|'palm'|'sapling';angle:number;}
export interface IslandPlant {x:number;z:number;size:number;angle:number;kind:'bush'|'fern'|'grass';}
export const ISLAND_TREES:IslandTree[]=[],ISLAND_PLANTS:IslandPlant[]=[];
export const ISLAND_ROCKS:Solid[]=[];
function rock(x:number,z:number,w:number,d:number,h:number){const points:[number,number][]=Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9,r=.88+random()*.12;return[x+Math.cos(a)*w/2*r,z+Math.sin(a)*d/2*r];});const solid=prism('Mossy rock',points,h);ISLAND_ROCKS.push(solid);return solid;}
rock(0,-.5,10.5,8,3.1);rock(-14,-11,5.2,4.5,2.2);rock(16,15,6.1,4.6,2.6);rock(5,-17,4,4.5,1.5);rock(-8,22,4.5,3.7,1.3);
const spawnClear=(x:number,z:number)=>Math.min(Math.hypot(x+36,z-18),Math.hypot(x-36,z+18));
const pickups:Pickup[]=[];
for(const side of [-1,1]){
 const base=side<0?'red':'blue';const kinds:Weapon[]=['smg','ak47','m4a1s','p90','scar','deagle'];
 kinds.forEach((weapon,i)=>{const x=side*(32+(i%3)*3.2),z=-side*(24+Math.floor(i/3)*3.2);pickups.push({id:`island-${base}-${weapon}`,weapon,base,x,y:0,z,availableAt:0});});
}
pickups.push({id:'island-north-awp',weapon:'marksman',x:0,y:0,z:-28,availableAt:0},{id:'island-south-m249',weapon:'m249',x:0,y:0,z:28,availableAt:0});
const suppliesClear=(x:number,z:number)=>pickups.every(p=>Math.hypot(p.x-x,p.z-z)>2.5);
for(let attempt=0;attempt<400&&ISLAND_ROCKS.length<28;attempt++){const x=(random()*2-1)*45,z=(random()*2-1)*35;if(islandRadius(x,z)>.88||spawnClear(x,z)<10||islandPathDistance({x,z})<5||!suppliesClear(x,z)||ISLAND_ROCKS.some(r=>Math.hypot(r.x-x,r.z-z)<7))continue;rock(x,z,2.4+random()*3.5,2.2+random()*3,1+random()*2.2);}
export const ISLAND_LOGS=[{x:-18,z:-3,length:6.2,axis:'x' as const},{x:19,z:7,length:5.5,axis:'z' as const},{x:-20,z:22,length:4.8,axis:'x' as const},{x:20,z:-18,length:5.4,axis:'z' as const}];
for(const log of ISLAND_LOGS){const w=log.axis==='x'?log.length:.85,d=log.axis==='z'?log.length:.85;prism('Fallen log',[[log.x-w/2,log.z-d/2],[log.x+w/2,log.z-d/2],[log.x+w/2,log.z+d/2],[log.x-w/2,log.z+d/2]],.85,'wood');}
function obstacle(x:number,z:number,radius:number){return solids.some(s=>s.kind!=='floor'&&s.style!=='water'&&Math.abs(x-s.x)<s.w/2+radius&&Math.abs(z-s.z)<s.d/2+radius);}
for(let attempt=0;attempt<10000&&ISLAND_TREES.length<168;attempt++){
 const x=(random()*2-1)*52,z=(random()*2-1)*43,r=islandRadius(x,z);
 if(r>.94||spawnClear(x,z)<8.5||Math.hypot(x,z)<10||islandPathDistance({x,z})<2.6||!suppliesClear(x,z)||obstacle(x,z,1)||ISLAND_TREES.some(t=>Math.hypot(t.x-x,t.z-z)<2.8))continue;
 const kind=r>.79?'palm':random()<.23?'sapling':'canopy',height=kind==='sapling'?3.6+random()*3.4:kind==='palm'?8+random()*5:8+random()*9,radius=kind==='sapling'?.13+random()*.09:kind==='palm'?.24+random()*.10:.28+random()*.24;
 ISLAND_TREES.push({x,y:0,z,radius,height,kind,angle:random()*Math.PI*2});
 const polygon:[number,number][]=Array.from({length:10},(_,i)=>[x+Math.cos(i*Math.PI/5)*radius,z+Math.sin(i*Math.PI/5)*radius]);prism('Tree trunk',polygon,height,'wood');
}
for(let attempt=0;attempt<6000&&ISLAND_PLANTS.length<460;attempt++){
 const x=(random()*2-1)*50,z=(random()*2-1)*41;
 if(islandRadius(x,z)>.88||spawnClear(x,z)<7||Math.hypot(x,z)<6||islandPathDistance({x,z})<.95||!suppliesClear(x,z)||obstacle(x,z,.25))continue;
 ISLAND_PLANTS.push({x,z,size:.45+random()*1.1,angle:random()*Math.PI*2,kind:random()<.32?'bush':random()<.55?'fern':'grass'});
}
export const JUNGLE_ISLAND:MapDefinition={
 id:'island',name:'Jungle Island',subtitle:'Coast · Jungle · Rock clearing',
 description:'A mid-sized tropical island. Cross dense jungle, flank along sandy coves, or fight around the central rock clearing.',
 bounds:{minX:-58,maxX:58,minZ:-48,maxZ:48},solids,pickups,spawnYaw:{red:-Math.PI/2,blue:Math.PI/2},
 spawns:{red:[{x:-39,y:0,z:18},{x:-36,y:0,z:15},{x:-36,y:0,z:21},{x:-33,y:0,z:18}],blue:[{x:39,y:0,z:-18},{x:36,y:0,z:-15},{x:36,y:0,z:-21},{x:33,y:0,z:-18}]},
 bombSites:[{id:'A',x:35,z:-18,w:6,d:6,minY:0,maxY:.15,marker:{x:35,y:0,z:-18,size:6}},{id:'B',x:-35,z:18,w:6,d:6,minY:0,maxY:.15,marker:{x:-35,y:0,z:18,size:6}}],
 landmarks:[{name:'WEST CAMP',x:-36,z:18},{name:'EAST CAMP',x:36,z:-18},{name:'ROCK CLEARING',x:0,z:8},{name:'NORTH TRAIL',x:0,z:-27},{name:'SOUTH COVE',x:0,z:29},{name:'PALM GROVE',x:-28,z:-15},{name:'A',x:35,z:-18},{name:'B',x:-35,z:18}],
};
