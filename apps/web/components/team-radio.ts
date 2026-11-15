import type {CombatEvent,Snapshot} from '@sirocco/shared';
export const RADIO_AUDIO={go:'/audio/radio/go-go-go.mp3',grenade:'/audio/radio/fire-in-the-hole.mp3'} as const;
export type RadioLine=keyof typeof RADIO_AUDIO;
/** Round numbers and release events come from the server, never local timers or clicks. */
export class TeamRadio {
 private round='';private pendingStart=false;private entered=false;private lastGrenade=0;
 constructor(private play:(line:RadioLine)=>void){}
 pause(){this.entered=false;this.pendingStart=false;}
 reset(){this.pause();this.round='';this.lastGrenade=0;}
 enter(){this.entered=true;this.flush();}
 update(state:Snapshot,id:string){
  const key=`${state.matchId}:${state.round}`,me=state.players.find(p=>p.id===id);
  if(key!==this.round){this.round=key;this.lastGrenade=0;this.pendingStart=state.phase==='playing'&&!!me?.hp;}
  if(state.phase!=='playing'||!me?.hp)this.pendingStart=false;
  this.flush();
 }
 combat(event:CombatEvent,state:Snapshot|undefined,id:string){
  if(!this.entered||event.type!=='grenade'||event.id<=this.lastGrenade)return;
  this.lastGrenade=event.id;
  if(state?.phase==='playing'&&state.players.find(p=>p.id===id)?.team===event.team)this.play('grenade');
 }
 private flush(){if(this.entered&&this.pendingStart){this.pendingStart=false;this.play('go');}}
}
