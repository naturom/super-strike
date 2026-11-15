import type {MapDefinition,Pickup,Solid,Weapon} from './index';

export const MARKET_SHOPS=([-1,1] as const).flatMap(side=>[-26,-12,12,26].map((x,i)=>({x,z:side*16.5,w:10,d:9,h:7.2+((i+(side>0?1:0))%3)*1.1,side,name:(side<0?['NOODLES','TEA HOUSE','DUMPLINGS','SEAFOOD']:['SATAY','FRUIT & JUICE','BAKERY','ARCADE'])[i],color:(side<0?['#b35a48','#477b72','#c6a55d','#637c96']:['#a67642','#648251','#8f6683','#5d8191'])[i]})));
export const MARKET_STRINGS=[{a:{x:-34.04,y:5.9,z:-8},b:{x:34.04,y:5.9,z:-8}},{a:{x:-34.04,y:5.9,z:8},b:{x:34.04,y:5.9,z:8}},...[-26,-12,12,26].map(x=>({a:{x,y:5.7,z:-12},b:{x,y:5.7,z:12}}))];
const solids:Solid[]=[];
function box(label:string,x:number,z:number,w:number,d:number,h:number,base=0,kind:Solid['kind']='wall',style:Solid['style']='plaster'){
 const solid:Solid={label,x,z,w,d,h,y:base+h/2,kind,style};solids.push(solid);return solid;
}
// Street and paving are partitions, never overlaid sheets at the same height.
const xs=[-34,-21,-7,7,21,34],zs=[-26,-21,-12,-5,5,12,21,26];
for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
 const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2,road=Math.abs(z)<5&&Math.abs(x)>7;
 box(road?'Market asphalt':'Market paving',x,z,xs[i]-xs[i-1],zs[j]-zs[j-1],.3,-.3,'floor',road?'road':'tile');
}
for(const shop of MARKET_SHOPS){
 box(`${shop.name} shophouse`,shop.x,shop.z,shop.w,shop.d,shop.h);
 box(`${shop.name} roof coping`,shop.x,shop.z,shop.w+.22,shop.d+.22,.18,shop.h,'roof','stone');
 const awning=box(`${shop.name} fabric awning`,shop.x,shop.side*11.2,8.8,1.6,.52,3.08,'roof','wood');
 awning.ramp={axis:'z',from:shop.side<0?3.6:3.15,to:shop.side<0?3.15:3.6};
}
// A central food pavilion interrupts spawn-to-spawn shots, with aisles around all sides.
for(const x of [-6,6])for(const z of [-5.5,5.5])box('Pavilion timber column',x,z,.26,.26,3.5,0,'wall','wood');
box('Pavilion kitchen island',0,0,2.8,7,2.6,0,'wall','metal');
for(const side of [-1,1]){
 box('Pavilion serving counter',side*2,0,1.2,6,1.05,0,'crate','wood');
 const roof=box('Pavilion tiled roof',side*3.4,0,6.8,12.4,1.0,3.35,'roof','stone');
 roof.ramp={axis:'x',from:side<0?3.55:4.35,to:side<0?4.35:3.55};
}
box('Pavilion ridge',0,0,.12,12.5,.1,4.35,'roof','metal');
for(const side of [-1,1]){
 box('Delivery cart',side*19,0,2.6,3.8,1.8,0,'crate','wood');
 box('Stacked produce crates',side*5,side*18,2.2,2.6,1.4,0,'crate','wood');
 box('Tea crates',side*22,-side*23.6,2.8,1.6,1.25,0,'crate','wood');
 box('Street planter',side*29.5,side*11,2.1,1.2,.7,0,'crate','stone');
}
// Thin tabletops and real legs keep both movement and bullets consistent with the furniture.
export const MARKET_TABLES=[{x:-10,z:-7},{x:10,z:7}];
for(const table of MARKET_TABLES){
 box('Dining table leg',table.x,table.z,.16,.16,.68,0,'wall','metal');
 const top=box('Dining tabletop',table.x,table.z,1.5,1.5,.07,.68,'crate','wood');
 top.polygon=Array.from({length:8},(_,i)=>[table.x+Math.cos(i*Math.PI/4)*.75,table.z+Math.sin(i*Math.PI/4)*.75] as [number,number]);
 for(const [dx,dz] of [[-1.25,0],[1.25,0],[0,-1.25],[0,1.25]]){
  const stool=box('Dining stool',table.x+dx,table.z+dz,.44,.44,.43,0,'crate','wood');
  stool.polygon=Array.from({length:8},(_,i)=>[stool.x+Math.cos(i*Math.PI/4)*.22,stool.z+Math.sin(i*Math.PI/4)*.22] as [number,number]);
 }
}
// The perimeter is real attached architecture. No scenery extends into a void.
for(const side of [-1,1]){
 box('Market boundary shophouse',side*34.25,0,.5,52.5,9.2);
 box('Market boundary rear wall',0,side*26.25,68,.5,8.2);
}
const pickups:Pickup[]=[];
for(const side of [-1,1]){
 const weapons:Weapon[]=['smg','ak47','m4a1s','p90','scar','deagle'];
 weapons.forEach((weapon,i)=>pickups.push({id:`market-${side<0?'red':'blue'}-${weapon}`,weapon,base:side<0?'red':'blue',x:side*(30-(i%3)*4),y:0,z:i<3?-8:8,availableAt:0}));
}
pickups.push({id:'market-awp',weapon:'marksman',x:0,y:0,z:-23.5,availableAt:0},{id:'market-m249',weapon:'m249',x:0,y:0,z:23.5,availableAt:0});
export const NIGHT_MARKET:MapDefinition={id:'market',name:'Night Market',subtitle:'Lantern street · Food hall · Back alleys',description:'A lantern-lit night market with colourful shophouses, covered food stalls, neon signs and two connected back-alley flanks.',solids,pickups,
 bounds:{minX:-34,maxX:34,minZ:-26,maxZ:26},spawnYaw:{red:-Math.PI/2,blue:Math.PI/2},
 spawns:{red:[{x:-29,y:0,z:-3},{x:-29,y:0,z:3},{x:-26,y:0,z:-3},{x:-26,y:0,z:3}],blue:[{x:29,y:0,z:3},{x:29,y:0,z:-3},{x:26,y:0,z:3},{x:26,y:0,z:-3}]},
 bombSites:[{id:'A',x:27,z:0,w:6,d:6,minY:0,maxY:.15,marker:{x:27,y:0,z:0,size:6}},{id:'B',x:-27,z:0,w:6,d:6,minY:0,maxY:.15,marker:{x:-27,y:0,z:0,size:6}}],
 landmarks:[{name:'WEST GATE',x:-28,z:0},{name:'EAST GATE',x:28,z:0},{name:'FOOD PAVILION',x:0,z:0},{name:'LANTERN STREET',x:0,z:9},{name:'NORTH ALLEY',x:0,z:-23.5},{name:'SOUTH ALLEY',x:0,z:23.5},{name:'TEA HOUSE',x:-19,z:-16},{name:'ARCADE',x:19,z:16},{name:'A',x:27,z:0},{name:'B',x:-27,z:0}],
};
