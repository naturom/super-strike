import type {Solid} from './index';

const CELL=6;
type Index={count:number;cells:Map<string,number[]>;large:number[]};
const indexes=new WeakMap<Solid[],Index>();

/** Static map geometry is indexed once; preserve author order for collision resolution. */
export function movementSolids(solids:Solid[],x:number,z:number,radius:number):Solid[]{
 if(solids.length<64)return solids;
 let index=indexes.get(solids);
 if(!index||index.count!==solids.length){
  index={count:solids.length,cells:new Map(),large:[]};
  for(let i=0;i<solids.length;i++){
   const b=solids[i],x0=Math.floor((b.x-b.w/2)/CELL),x1=Math.floor((b.x+b.w/2)/CELL),z0=Math.floor((b.z-b.d/2)/CELL),z1=Math.floor((b.z+b.d/2)/CELL);
   if((x1-x0+1)*(z1-z0+1)>32){index.large.push(i);continue;}
   for(let cx=x0;cx<=x1;cx++)for(let cz=z0;cz<=z1;cz++){const key=`${cx},${cz}`,cell=index.cells.get(key);if(cell)cell.push(i);else index.cells.set(key,[i]);}
  }
  indexes.set(solids,index);
 }
 const ids=new Set(index.large);
 for(let cx=Math.floor((x-radius)/CELL);cx<=Math.floor((x+radius)/CELL);cx++)for(let cz=Math.floor((z-radius)/CELL);cz<=Math.floor((z+radius)/CELL);cz++)for(const id of index.cells.get(`${cx},${cz}`)??[])ids.add(id);
 return [...ids].sort((a,b)=>a-b).map(i=>solids[i]);
}
