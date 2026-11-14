import type {Solid,Vec3} from './index';
import type {Ladder} from './ladders';
/** Radar-space coordinates keep the tower aligned with the carved Mid bazaar. */
export const SCOUT_TOWER={base:1.7,deck:15.14,levels:4,floors:8,rise:3.36,entry:[530,550] as const,center:[567,525] as const};
export function scoutTowerSolids(point:(u:number,v:number,y?:number)=>Vec3,scale:number):Solid[]{
 const solids:Solid[]=[];
 const box=(label:string,u:number,v:number,w:number,d:number,bottom:number,top:number,kind:Solid['kind']='wall',style:Solid['style']='plaster')=>{
  const b:Solid={...point(u+w/2,v+d/2,(bottom+top)/2),w:w*scale,d:d*scale,h:top-bottom,kind,style,label:`Scout tower ${label}`};solids.push(b);return b;
 };
 const slab=(name:string,u:number,v:number,w:number,d:number,top:number)=>box(name,u,v,w,d,top-.22,top,'floor','tile');
 box('foundation',532,480,70,90,-.3,SCOUT_TOWER.base,'floor','tile');
 box('west wall north',532,480,4,60,1.7,SCOUT_TOWER.deck-.22);box('west wall south',532,558,4,12,1.7,SCOUT_TOWER.deck-.22);
 box('entry lintel',532,540,4,18,4.5,SCOUT_TOWER.deck-.22);
 box('north wall',536,480,62,4,1.7,SCOUT_TOWER.deck-.22);box('east wall',598,480,4,90,1.7,SCOUT_TOWER.deck-.22);box('south wall',536,566,62,4,1.7,SCOUT_TOWER.deck-.22);
 // A continuous enclosed ladder replaces all flights and intermediate landings.
 // Fill the old stairwell, leaving just a guarded hatch against the north wall.
 slab('lookout south',514,507,106,81,SCOUT_TOWER.deck);slab('lookout west',514,484,45,23,SCOUT_TOWER.deck);
 slab('lookout north',514,462,106,22,SCOUT_TOWER.deck);slab('lookout east',575,484,45,23,SCOUT_TOWER.deck);
 for(const [name,u,v,w,d] of [['south',514,586,106,2],['north',514,462,106,2],['west',514,464,2,122],['east',618,464,2,122]] as const)box(`lookout parapet ${name}`,u,v,w,d,SCOUT_TOWER.deck,SCOUT_TOWER.deck+.78);
 // The north side is the ladder exit; the other three sides protect the hatch.
 box('hatch guard south',557.6,507,18.8,1.4,SCOUT_TOWER.deck,SCOUT_TOWER.deck+.9);
 box('hatch guard west',557.6,484,1.4,23,SCOUT_TOWER.deck,SCOUT_TOWER.deck+.9);
 box('hatch guard east',575,484,1.4,23,SCOUT_TOWER.deck,SCOUT_TOWER.deck+.9);
 for(const u of [516,616])for(const v of [464,584])box('canopy pier',u,v,2,2,SCOUT_TOWER.deck+.78,SCOUT_TOWER.deck+3.15);
 box('canopy',513,461,108,128,SCOUT_TOWER.deck+3.15,SCOUT_TOWER.deck+3.4,'roof');
 return solids;
}
export function scoutTowerLadder(point:(u:number,v:number,y?:number)=>Vec3,scale:number):Ladder{
 return {id:'scout-tower',label:'Scout tower',side:'inside',...point(567,484+.56/scale),bottom:SCOUT_TOWER.base,top:SCOUT_TOWER.deck,width:1.1,normal:{x:0,z:1}};
}
/** Entry, ladder approach and lookout exit, used by local navigation checks. */
export function scoutTowerRoute(){
 return [{u:520,v:550,y:SCOUT_TOWER.base},{u:567,v:550,y:SCOUT_TOWER.base},{u:567,v:499,y:SCOUT_TOWER.base},{u:567,v:473,y:SCOUT_TOWER.deck}];
}
