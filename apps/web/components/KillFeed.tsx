'use client';
import React,{memo,useEffect,useState} from 'react';
import {weaponLabel,type CombatEvent} from '@sirocco/shared';

export const KILL_FEED_MS=9000,KILL_FEED_LIMIT=5;
export type KillFeedEntry=CombatEvent&{at:number};

export function killDescription(event:CombatEvent){
 const victim=event.victim??'Player',weapon=event.weapon==='grenade'?'FRAG GRENADE':event.weapon==='bomb'?'C4 EXPLOSION':weaponLabel(event.weapon);
 if(event.cause==='fall')return {victim,method:'FALL DAMAGE',killer:null,detail:'',label:`${victim} died from fall damage`};
 if(event.cause==='dog'){const killer=`${event.name??'Player'}’s dog`;return {victim,method:'DOG BITE',killer,detail:'',label:`${killer} killed ${victim}`};}
 if(event.cause==='trex')return {victim,method:'MAULING',killer:'T-REX',detail:'',label:`T-REX killed ${victim} by mauling`};
 if(event.shooter===event.target)return {victim,method:weapon,killer:null,detail:'SELF',label:`${victim} killed themselves with ${weapon}`};
 const killer=event.name??'Unknown player',detail=event.hitZone==='head'?'HEADSHOT':'';
 return {victim,method:weapon,killer,detail,label:`${killer} killed ${victim} with ${weapon}${detail?' · headshot':''}`};
}

export const KillFeed=memo(function KillFeed({entries,localId}:{entries:KillFeedEntry[];localId?:string}){
 const [clock,tick]=useState(0),now=Date.now(),visible=entries.filter(e=>now-e.at<KILL_FEED_MS).slice(-KILL_FEED_LIMIT).reverse();
 // Expire even if snapshots stop arriving during the results screen or a disconnect.
 useEffect(()=>{
  const now=Date.now(),expiry=Math.min(...entries.map(e=>e.at+KILL_FEED_MS).filter(t=>t>now));
  if(!Number.isFinite(expiry))return;
  const timer=setTimeout(()=>tick(c=>c+1),Math.max(1,expiry-now));return()=>clearTimeout(timer);
 },[entries,clock]);
 return <div className="killfeed" role="log" aria-label="Kill feed" aria-live="polite" aria-relevant="additions">
  {!!visible.length&&<span className="killfeed-title" aria-hidden="true">RECENT ELIMINATIONS</span>}
  {visible.map(e=>{
   const text=killDescription(e),actor=text.killer??text.victim,actorTeam=text.killer?(e.cause==='trex'?undefined:e.team):e.victimTeam??e.team,death=e.target===localId,own=e.shooter===localId&&!death;
   return <div key={e.id} className={`killfeed-row${death?' killfeed-death':own?' killfeed-kill':''}`} aria-label={text.label}>
    <b className={actorTeam?`team-${actorTeam}`:''} title={actor}>{actor}</b>
    <span className="killfeed-method">{text.method}{text.detail&&<strong className={text.detail==='HEADSHOT'?'headshot-badge':'killfeed-self'}>{text.detail}</strong>}</span>
    {text.killer&&<><span className="killfeed-arrow" aria-hidden="true">→</span><b className={e.victimTeam?`team-${e.victimTeam}`:''} title={text.victim}>{text.victim}</b></>}
   </div>;
  })}
 </div>;
});
