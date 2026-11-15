import {randomInt} from 'node:crypto';
import type {Pickup,Team} from '@sirocco/shared';

/** Only the server keeps the selected rack IDs. Ordinary snapshots reveal nothing. */
export function flowerPickupIds(pickups:Pickup[],choose:(length:number)=>number=randomInt){
 const selected=new Set<string>();
 for(const team of ['red','blue'] as Team[]){
  const racks=pickups.filter(p=>p.base===team);
  if(racks.length)selected.add(racks[choose(racks.length)].id);
 }
 return selected;
}
