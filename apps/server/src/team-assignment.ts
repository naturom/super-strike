import {randomInt} from 'node:crypto';
import type {Team} from '@sirocco/shared';
/** Shuffle the whole roster, then deal balanced teams with a random starting side. */
export function assignRandomTeams(users:Iterable<{id:string}>,choose:(max:number)=>number=randomInt):Map<string,Team>{
 const ids=Array.from(users,user=>user.id),teams=new Map<string,Team>();
 if(!ids.length)return teams;
 for(let i=ids.length-1;i>0;i--){const j=choose(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
 const first:Team=choose(2)===0?'red':'blue',second:Team=first==='red'?'blue':'red';
 ids.forEach((id,index)=>teams.set(id,index%2?second:first));return teams;
}
