import type {Solid,Vec3} from './index';
import type {Ladder} from './ladders';

/** Four outside-only recovery ladders on clear perimeter faces. */
export function dustReturnLadders(solids:Solid[],point:(u:number,v:number,y?:number)=>Vec3,scale:number):Ladder[]{
 const ladders:Ladder[]=[],thickness=7*scale;
 const stations=[
  {id:'north',label:'North return',u:96,v:16,nx:0,nz:-1},
  {id:'east',label:'Long return',u:925,v:425,nx:1,nz:0},
  {id:'south',label:'T spawn return',u:360,v:977,nx:0,nz:1},
  {id:'west',label:'West return',u:66,v:230,nx:-1,nz:0},
 ];
 for(const station of stations){
  const p=point(station.u,station.v),wall=solids.find(b=>b.label==='Perimeter'&&Math.abs(b.x-p.x)<=b.w/2+.01&&Math.abs(b.z-p.z)<=b.d/2+.01)!;
  const top=wall.y+wall.h/2+.14,offset=thickness/2+.56;
  ladders.push({id:`return-${station.id}-outside`,label:station.label,side:'outside',x:p.x+station.nx*offset,z:p.z+station.nz*offset,bottom:0,top,width:1.1,normal:{x:station.nx,z:station.nz}});
  const alongX=!!station.nz,depth=thickness+.10;
  solids.push({...p,y:top-.06,w:alongX?1.55:depth,h:.12,d:alongX?depth:1.55,kind:'floor',style:'metal',label:`Return ladder ${station.id} landing`});
  for(const side of [-1,1])solids.push({x:p.x+station.nz*.75*side,z:p.z-station.nx*.75*side,y:top+.36,w:alongX?.055:depth,h:.72,d:alongX?depth:.055,kind:'wall',style:'metal',label:`Return ladder ${station.id} side guard`});
 }
 return ladders;
}
