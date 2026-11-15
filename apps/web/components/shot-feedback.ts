import {DT,KNIFE,WEAPONS,isGun,type CombatEvent,type Input,type Player,type Weapon} from '@sirocco/shared';

/** Cosmetic prediction only. Hits, ammunition and damage stay server-owned. */
export class ShotFeedback {
 private player?:Player;
 private time=0;
 private next=0;
 private trigger=false;
 private shown:{seq:number;spawnId:number;weapon:Weapon;at:number}[]=[];
 reset(){this.player=undefined;this.shown=[];}
 sync(player:Player,time:number,pending:Input[]){
  if(this.player?.spawnId!==player.spawnId)this.shown=[];
  this.player={...player,ammo:{...player.ammo}};this.time=time;
  this.next=time+Math.floor((player.gunState??6)/2)*DT*1000;this.trigger=!!((player.gunState??0)%2);
  for(const input of pending)this.advance(input);
 }
 private advance(input:Input):Weapon|undefined{
  const p=this.player;if(!p)return;
  this.time+=DT*1000;
  if(!p.hp||!p.connected||input.spawnId!==undefined&&input.spawnId!==p.spawnId)return;
  if(isGun(p.weapon)&&p.reloadUntil&&this.time>=p.reloadUntil){p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
  if(!(p.grenadeThrow&&!p.grenadeThrow.released)&&input.weapon!==p.weapon&&(input.weapon===p.primary||input.weapon===(p.secondary??'pistol')||!isGun(input.weapon))){
   p.weapon=input.weapon;p.reloadUntil=0;this.next=Math.max(this.next,this.time+(isGun(p.weapon)?200:0));
  }
  const was=this.trigger;this.trigger=input.fire;
  if(p.weapon==='knife'){if(input.fire&&!was&&this.time+.01>=this.next)this.next=this.time+KNIFE.interval;return;}
  if(!isGun(p.weapon))return;
  const w=WEAPONS[p.weapon];
  if(input.reload&&!p.reloadUntil&&(p.ammo[p.weapon]??0)<w.magazine)p.reloadUntil=this.time+w.reload;
  if(!input.fire||input.sprint&&!input.crouch||p.reloadUntil||(p.ammo[p.weapon]??0)<=0||!w.automatic&&was||this.time+.01<this.next)return;
  // Every new pickup waits for the same server verdict, so a hidden flower gun
  // never emits a speculative bullet and normal racks cannot be distinguished.
  if(p.untestedWeapons?.includes(p.weapon)||p.flowerWeapons?.includes(p.weapon)){this.next=this.time+w.interval;return;}
  p.ammo[p.weapon]=p.ammo[p.weapon]!-1;this.next=this.time+w.interval;return p.weapon;
 }
 predict(input:Input,now:number){
  const weapon=this.advance(input);if(!weapon)return;
  this.shown=this.shown.filter(s=>now-s.at<3000).slice(-100);
  this.shown.push({seq:input.seq,spawnId:this.player!.spawnId,weapon,at:now});return weapon;
 }
 /** A confirmation must not play the same flash, sound or trail a second time.
  * A small sequence tolerance covers server ticks with no queued input. */
 confirm(event:CombatEvent){
  const index=this.shown.findIndex(s=>s.weapon===event.weapon&&s.spawnId===event.spawnId&&s.seq===event.inputSeq);
  const nearby=index>=0?index:this.shown.findIndex(s=>s.weapon===event.weapon&&s.spawnId===event.spawnId&&event.inputSeq!==undefined&&Math.abs(s.seq-event.inputSeq)<=2);
  if(nearby<0)return false;this.shown.splice(nearby,1);return true;
 }
}
