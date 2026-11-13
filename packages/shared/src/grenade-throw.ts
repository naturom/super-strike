/** Pin pull, an indefinite aiming hold, then the release/follow-through. */
export const GRENADE_THROW={durationMs:1000,holdMs:540,releaseMs:700,pinPullStart:.14,pinPullEnd:.34,fuseMs:2200} as const;
export const GRENADE_BLAST={radius:8.8,damageCap:110,centreDamage:130} as const;
export function grenadeBlastDamage(distance:number){
 return !Number.isFinite(distance)||distance>=GRENADE_BLAST.radius?0:Math.min(GRENADE_BLAST.damageCap,GRENADE_BLAST.centreDamage*(1-Math.max(0,distance)/GRENADE_BLAST.radius));
}
export type GrenadeThrow={startedAt:number;released:boolean;releaseAt?:number;yaw?:number;pitch?:number};
export function grenadeThrowProgress(action:GrenadeThrow|undefined,time:number){
 if(!action)return 0;
 const {durationMs,holdMs,releaseMs}=GRENADE_THROW,hold=holdMs/durationMs,release=releaseMs/durationMs;
 let progress=Math.max(0,Math.min(1,(time-action.startedAt)/durationMs));
 if(action.releaseAt!==undefined){
  const throwStarts=action.releaseAt-(releaseMs-holdMs);
  progress=time<throwStarts?Math.min(hold,progress):Math.max(hold,Math.min(1,(time-action.releaseAt+releaseMs)/durationMs));
 }else if(!action.released)return Math.min(hold,progress);
 return action.released?Math.max(release,progress):Math.min(release-.000001,progress);
}
export const grenadeReleased=(progress:number)=>progress>=GRENADE_THROW.releaseMs/GRENADE_THROW.durationMs;
