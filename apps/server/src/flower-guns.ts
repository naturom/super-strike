import {randomInt} from 'node:crypto';
import {isSidearm,type Pickup,type Team} from '@sirocco/shared';

/** Only the server keeps the selected rack IDs. Ordinary snapshots reveal nothing. */
export function flowerPickupIds(pickups:Pickup[],choose:(length:number)=>number=randomInt){
 const selected=new Set<string>();
 for(const team of ['red','blue'] as Team[]){
  const racks=pickups.filter(p=>p.base===team&&!isSidearm(p.weapon));
  if(racks.length)selected.add(racks[choose(racks.length)].id);
 }
 return selected;
}
