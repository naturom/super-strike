import {assignRandomTeams} from './team-assignment';
import {DogSimulation} from './dog-simulation';
import {flowerPickupIds} from './flower-guns';
import {TrexSimulation} from './trex-simulation';
import {PLAYER_HEALTH,DEFAULT_TEAM_AVATARS,validTeamAvatars,type TeamAvatars,GRENADE_THROW,GRENADE_BLAST,grenadeBlastDamage,freshAmmo,isSidearm} from '@sirocco/shared';
import {randomUUID} from 'node:crypto';
import {DOG_RULES,rayDog,type Dog,DT,NEXT_GAME_COUNTDOWN_MS,BOMB_RESULT_DELAY_MS,TREX_RULES,rayTrex,type Trex,RESPAWN_MS,IMPACT_RULES,impactTarget,type ImpactMark,RADIUS,fallDamage,groundAt,fullySubmerged,WATER_RULES,TEAMS,sprayTarget,type Spray,BOMB_RULES,plantSite,canReachBomb,footprint,solidTop,intersects,ROUND_MS,WIN_SCORE,MAPS,DEFAULT_MAP,WEAPONS,KNIFE,isGun,direction,move,neutralInput,rayBox,rayPlayer,type HitZone,wallDistance,heightOf,eyeOf,nearestPickup,type Input,type Player,type Snapshot,type CombatEvent,type Solid,type Team,type MapId,type Pickup,type Grenade,type Equipment,type Vec3,type GameMode,type BombState} from '@sirocco/shared';
export class Simulation {
  players=new Map<string,Player>();
  queues=new Map<string,Input[]>();
  private lastSeq=new Map<string,number>();
  private nextShot=new Map<string,number>();
  private trigger=new Map<string,boolean>();
  private actions=new Map<string,{interact:boolean;throwAt:number}>();
  private waterExposure=new Map<string,{since:number;nextDamage:number}>();
  private falls=new Map<string,{height:number}>();
  private flowerRacks=new Set<string>();
  private flowerInventory=new Map<string,Set<import('@sirocco/shared').Weapon>>();
  private droppedGunId=0;
  private droppedFlowers=new Map<string,{flower:boolean;revealed:boolean;untested:boolean}>();
  private eventId=0;
  events:CombatEvent[]=[];
  sprays:Spray[]=[];impacts:ImpactMark[]=[];
  scores={red:0,blue:0};
  time=0;endsAt=ROUND_MS;nextRoundAt=0;phase:Snapshot['phase']='playing';winner:Snapshot['winner']=null;
  bombs:BombState[]=[];get bomb(){return this.bombs[0]??null;}outcome='';roundLive=false;
  private bombIntents=new Map<string,{input:Input;at:number}>();
  round=1;readonly matchId=randomUUID();
  readonly mapId:MapId;
  readonly teamAvatars:TeamAvatars;
  solids:Solid[];pickups:Pickup[];grenades:Grenade[]=[];readonly wildlife:TrexSimulation;get trexes(){return this.wildlife.creatures;}readonly companions:DogSimulation;get dogs(){return this.companions.dogs;}
  constructor(mapOrSolids:MapId|Solid[]=DEFAULT_MAP,readonly mode:GameMode='deathmatch',teamAvatars:TeamAvatars=DEFAULT_TEAM_AVATARS,readonly moreFun=true){if(typeof moreFun!=='boolean')throw new Error('Invalid More fun setting');if(!validTeamAvatars(teamAvatars))throw new Error('Choose a different character for each team');this.teamAvatars=Object.freeze({...teamAvatars});this.mapId=typeof mapOrSolids==='string'?mapOrSolids:'relay';this.solids=typeof mapOrSolids==='string'?MAPS[mapOrSolids].solids:mapOrSolids;this.pickups=MAPS[this.mapId].pickups.map(p=>({...p}));this.flowerRacks=this.moreFun?flowerPickupIds(this.pickups):new Set();this.wildlife=new TrexSimulation(MAPS[this.mapId],()=>this.solids);this.companions=new DogSimulation(MAPS[this.mapId],()=>this.solids);if(mode==='defusal'){if(!MAPS[this.mapId].bombSites?.length)throw new Error('This map has no bomb sites');this.endsAt=0;this.resetBomb();}}
  add(id:string,name:string):Player {
    if(this.players.size>=8)throw new Error('Room full (8/8).');
    const red=[...this.players.values()].filter(p=>p.team==='red').length,blue=this.players.size-red;
    const team:Team=red<=blue?'red':'blue';
    const p:Player={id,name,team,avatar:this.teamAvatars[team],x:0,y:0,z:0,vy:0,grounded:true,crouched:false,yaw:team==='red'?0:Math.PI,pitch:0,hp:100,kills:0,deaths:0,weapon:'rifle',primary:'rifle',ammo:freshAmmo(),grenades:2,reloadUntil:0,respawnAt:0,protectedUntil:0,connected:true,ack:0,spawnId:0};
    this.players.set(id,p);this.queues.set(id,[]);this.spawn(p);if(this.mode==='defusal'&&this.roundLive){p.hp=0;p.respawnAt=0;}return p;
  }
  remove(id:string){const p=this.players.get(id);if(p&&p.hp>0&&this.phase==='playing')this.dropGuns(p);this.companions.removeOwner(id);this.flowerInventory.delete(id);this.falls.delete(id);this.waterExposure.delete(id);this.dropBomb(id);this.bombIntents.delete(id);this.players.delete(id);this.queues.delete(id);this.lastSeq.delete(id);this.nextShot.delete(id);this.trigger.delete(id);this.actions.delete(id);}
  input(id:string,i:Input){
    // Sequence IDs order packets; they do not grant simulation time. After a
    // stall/rate-limit burst, accept the next newer ID rather than locking this
    // player out forever. Movement still consumes at most one input per tick.
    const prev=this.lastSeq.get(id)??0;if(!Number.isSafeInteger(i.seq)||i.seq<0||i.seq>=2**31||i.seq<=prev)return;const resumed=i.seq-prev>120;this.lastSeq.set(id,i.seq);const p=this.players.get(id);if(!p)return;if(p.hp<=0||this.phase!=='playing'||i.spawnId!==undefined&&i.spawnId!==p.spawnId){p.ack=Math.max(p.ack,i.seq);return;}const q=this.queues.get(id);if(!q)return;if(resumed)q.length=0;if(q.length>=8)q.shift();q.push(i);return resumed;
  }
  spawn(p:Player){
    p.avatar=this.teamAvatars[p.team];p.spawnId++;p.ack=Math.max(p.ack,this.lastSeq.get(p.id)??0);
    this.falls.delete(p.id);this.waterExposure.delete(p.id);this.flowerInventory.delete(p.id);p.untestedWeapons=undefined;p.flowerWeapons=undefined;
    const others=[...this.players.values()].filter(o=>o.id!==p.id&&o.hp>0);
    const spots=MAPS[this.mapId].spawns[p.team].map(s=>({s,safety:Math.min(...others.map(o=>Math.hypot(o.x-s.x,o.z-s.z)),100)}));spots.sort((a,b)=>b.safety-a.safety);
    Object.assign(p,spots[0].s,{hp:100,vy:0,grounded:true,crouched:false,ammo:freshAmmo(),weapon:'rifle',primary:'rifle',secondary:'pistol',scope:undefined,grenades:2,grenadeThrow:undefined,reloadUntil:0,respawnAt:0,death:undefined,climbing:undefined,protectedUntil:this.time+1500,yaw:MAPS[this.mapId].spawnYaw?.[p.team]??(p.team==='red'?0:Math.PI),pitch:0});
    this.queues.set(p.id,[]);this.trigger.delete(p.id);this.actions.set(p.id,{interact:false,throwAt:0});this.nextShot.set(p.id,this.time+100);
    // Assign an unclaimed charge before play starts. Full game resets rebuild
    // both charges after everyone has spawned.
    if(this.mode==='defusal'&&!this.roundLive&&p.connected){const bomb=this.bombs.find(b=>b.team===p.team);if(bomb?.status==='dropped'&&!bomb.carrierId)Object.assign(bomb,{x:p.x,y:p.y,z:p.z,status:'carried',carrierId:p.id,siteId:null,explodeAt:0,action:null});}
  }
  step(){
    this.time+=DT*1000;this.events=[];this.sprays=this.sprays.filter(s=>s.expiresAt>this.time);this.impacts=this.impacts.filter(s=>s.expiresAt>this.time);if(this.phase==='finished'){if(!this.nextRoundAt)this.scheduleNextGame();if(this.time+.001>=this.nextRoundAt)this.rematch();return;}
    if(this.mode==='defusal'&&!this.roundLive&&['red','blue'].every(team=>[...this.players.values()].some(p=>p.team===team&&p.connected&&p.hp>0)))this.roundLive=true;
    if(this.mode==='deathmatch'&&this.time>=this.endsAt){this.finish();return;}
    for(const p of this.players.values()){
      if(this.winner!==null)break;
      if(p.hp<=0){if(this.mode==='deathmatch'&&this.time>=p.respawnAt)this.spawn(p);continue;}
      if(isGun(p.weapon)&&p.reloadUntil&&this.time>=p.reloadUntil){p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
      const i=this.queues.get(p.id)?.shift();
      const controls=i&&p.connected?i:{...neutralInput(),yaw:p.yaw,pitch:p.pitch,weapon:p.weapon,crouch:p.crouched};
      const wasGrounded=p.grounded,fromY=p.y;
      // Track each uninterrupted fall on every map, regardless of its starting
      // surface. Include the jump apex and use movement's actual landing height.
      if(wasGrounded)this.falls.delete(p.id);
      Object.assign(p,move(p,controls,this.solids,MAPS[this.mapId].ladders));
      const peak=Math.max(this.falls.get(p.id)?.height??fromY,fromY,p.y);
      if(p.climbing)this.falls.delete(p.id);
      else if(p.grounded){this.falls.delete(p.id);const amount=fallDamage(peak-p.y);if(amount)this.damage(p,amount,p,p.weapon,p,undefined,'fall');}
      else this.falls.set(p.id,{height:peak});
      if(p.hp<=0)continue;
      this.stepWater(p);
      if(p.hp<=0)continue;
      if(!i||!p.connected)continue;
      this.bombIntents.set(p.id,{input:i,at:this.time});
      p.ack=i.seq;p.yaw=i.yaw;p.pitch=i.pitch;
      if(this.moreFun&&i.summon){const creature=this.wildlife.summon(p,this.time,[...this.players.values()]);if(creature)this.emit('trexRoar',p,'knife',creature,creature,{target:creature.id});}
      if(this.moreFun&&i.dog){const dog=this.companions.deploy(p,this.time,[...this.players.values()]);if(dog)this.emit('dogDeploy',p,'knife',dog,dog,{target:dog.id});}
      if(i.spray){
        const target=sprayTarget(this.eye(p),direction(p.yaw,p.pitch),this.solids);
        if(target){this.sprays.push({id:++this.eventId,owner:p.id,...target,expiresAt:this.time+120000});this.sprays=this.sprays.slice(-24);this.emit('spray',p,p.weapon,this.eye(p),target.position);}
      }
      const ownBomb=this.bombs.find(b=>b.team===p.team),enemyBomb=this.bombs.find(b=>b.team!==p.team);
      if(!(p.grenadeThrow&&!p.grenadeThrow.released)&&i.weapon!==p.weapon&&(i.weapon===p.primary||i.weapon===(p.secondary??'pistol')||i.weapon==='knife'||i.weapon==='grenade'&&(p.grenades>0||!!p.grenadeThrow)||i.weapon==='bomb'&&ownBomb?.carrierId===p.id&&ownBomb.status==='carried')){p.weapon=i.weapon;p.reloadUntil=0;this.nextShot.set(p.id,Math.max(this.nextShot.get(p.id)??0,this.time+(isGun(p.weapon)?200:0)));}
      p.scope=p.weapon==='marksman'&&!p.reloadUntil&&!i.sprint&&(i.scope===1||i.scope===2)?i.scope:undefined;
      const action=this.actions.get(p.id)!;
      if(i.interact&&!action.interact){if(ownBomb?.status==='dropped'&&canReachBomb(p,ownBomb,this.solids)){ownBomb.status='carried';ownBomb.carrierId=p.id;this.emit('pickup',p,'bomb',p,p);}else if(!(enemyBomb?.status==='planted'&&canReachBomb(p,enemyBomb,this.solids)))this.pickup(p);}
      action.interact=!!i.interact;
      const was=this.trigger.get(p.id)??false;
      const heldGrenade=p.grenadeThrow;
      if(heldGrenade&&!heldGrenade.released&&heldGrenade.releaseAt===undefined&&!i.fire){
        // Only an actual release input starts the throw. Missing packets never
        // release a held grenade. Aim stays live through the forward throw.
        heldGrenade.releaseAt=Math.max(this.time,heldGrenade.startedAt+GRENADE_THROW.holdMs)+GRENADE_THROW.releaseMs-GRENADE_THROW.holdMs;
        action.throwAt=heldGrenade.releaseAt+GRENADE_THROW.durationMs-GRENADE_THROW.releaseMs;
      }
      if(p.weapon==='bomb'||i.weapon==='bomb'||enemyBomb?.status==='planted'&&i.interact&&canReachBomb(p,enemyBomb,this.solids)){p.reloadUntil=0;this.trigger.set(p.id,i.fire);continue;}
      if(p.weapon==='grenade'){
        if(i.fire&&!was&&!p.grenadeThrow&&this.time>=action.throwAt&&p.grenades>0){p.grenades--;p.protectedUntil=0;p.grenadeThrow={startedAt:this.time,released:false};action.throwAt=this.time+GRENADE_THROW.durationMs;this.emit('grenadePrime',p,'grenade',this.eye(p),this.eye(p));}
      }else if(p.weapon==='knife'){
        if(i.fire&&!was&&this.time+.01>=(this.nextShot.get(p.id)??0))this.fire(p);
      }else{
        const w=WEAPONS[p.weapon];
        if(i.reload&&!p.reloadUntil&&(p.ammo[p.weapon]??0)<w.magazine){p.reloadUntil=this.time+w.reload;p.scope=undefined;this.emit('reload',p,p.weapon,this.eye(p),this.eye(p));}
        if(i.fire&&(!i.sprint||p.crouched)&&!p.reloadUntil&&(p.ammo[p.weapon]??0)>0&&(w.automatic||!was)&&this.time+.01>=(this.nextShot.get(p.id)??0))this.fire(p);
      }
      this.trigger.set(p.id,i.fire);
    }
    if(this.phase==='playing')this.stepGrenadeThrows();
    if(this.phase==='playing')this.wildlife.step(this.time,[...this.players.values()],(victim,trex)=>this.damage(victim,TREX_RULES.biteDamage,{id:trex.id,team:victim.team},'knife',trex,undefined,'trex'),trex=>this.emit(trex.state==='attack'?'trexAttack':'trexRoar',{id:trex.id,team:'red'},'knife',trex,trex,{target:trex.id}));
    if(this.phase==='playing')this.companions.step(this.time,[...this.players.values()],(victim,dog)=>this.damage(victim,DOG_RULES.biteDamage,{id:dog.owner,team:dog.team},'knife',dog,undefined,'dog'),dog=>this.emit('dogBite',{id:dog.owner,team:dog.team},'knife',dog,dog,{target:dog.id}));
    if(this.phase==='playing')this.stepGrenades();
    if(this.phase==='playing'&&this.bombs.length)this.stepBomb();
  }
  private stepWater(p:Player){
    if(!fullySubmerged(p,MAPS[this.mapId].water)){this.waterExposure.delete(p.id);return;}
    let exposure=this.waterExposure.get(p.id);
    if(!exposure){exposure={since:this.time,nextDamage:this.time+WATER_RULES.breathMs};this.waterExposure.set(p.id,exposure);}
    if(this.time>exposure.nextDamage+.001){exposure.nextDamage+=WATER_RULES.damageIntervalMs;this.damage(p,WATER_RULES.damage,p,p.weapon,p,undefined,'water');}
  }
  private eye(p:Player):Vec3{return{x:p.x,y:p.y+eyeOf(p),z:p.z};}
  private emit(type:CombatEvent['type'],p:{id:string;team:Team},weapon:Equipment,from:Vec3,to:Vec3,extra:Partial<CombatEvent>={}){this.events.push({type,id:++this.eventId,shooter:p.id,team:p.team,weapon,from:{...from},to:{...to},...extra});}
  private dropGun(p:Player,weapon:import('@sirocco/shared').Weapon,side=1){
    const yaw=p.yaw+side*.35,sin=Math.sin(yaw),cos=Math.cos(yaw);
    // Reserve the whole resting gun, including its barrel, around display stands.
    // This envelope covers every gun model at the shared .8 ground-pickup scale.
    const halfX=Math.abs(cos)*.32+Math.abs(sin)*.68,halfZ=Math.abs(sin)*.32+Math.abs(cos)*.68;
    const overlapsStand=(at:Vec3,rack:Pickup)=>Math.abs(rack.y-at.y)<.6&&Math.abs(rack.x-(at.x-.26*sin))<.625+halfX+.08&&Math.abs(rack.z-(at.z-.26*cos))<.375+halfZ+.08;
    const clearOfStands=(at:Vec3)=>!MAPS[this.mapId].pickups.some(rack=>overlapsStand(at,rack));
    let position:Vec3|undefined,clearFallback:Vec3|undefined;
    for(const distance of [.65,1.1,1.5,1.7,2.1,2.6]){for(const angle of [p.yaw+side*.45,p.yaw-side*Math.PI/2,p.yaw+Math.PI,p.yaw,p.yaw+Math.PI/4,p.yaw-Math.PI/4,p.yaw+Math.PI*.75,p.yaw-Math.PI*.75]){
      const dir={x:-Math.sin(angle),y:0,z:-Math.cos(angle)},candidate={x:p.x+dir.x*distance,y:p.y,z:p.z+dir.z*distance};
      if(wallDistance({x:p.x,y:p.y+.25,z:p.z},dir,this.solids)<distance+.15)continue;
      let floor=groundAt(candidate,this.solids,p.y+.35);for(const b of this.solids)if(footprint(candidate,b,0)){const top=solidTop(b,candidate);if(top<=p.y+.35)floor=Math.max(floor,top);}
      candidate.y=floor;if(this.solids.some(b=>intersects(candidate,b,.18,.15))||!clearOfStands(candidate))continue;
      clearFallback??=candidate;if(!this.pickups.some(g=>g.dropped&&Math.abs(g.y-floor)<.3&&Math.hypot(g.x-candidate.x,g.z-candidate.z)<.45)){position=candidate;break;}
    }if(position)break;}
    position??=clearFallback;
    if(!position){
      let floor=groundAt(p,this.solids,p.y+.35);for(const b of this.solids)if(footprint(p,b,0)){const top=solidTop(b,p);if(top<=p.y+.35)floor=Math.max(floor,top);}
      // If entirely boxed in, rest above a stand rather than embedding in it.
      if(this.mapId==='dunes'||this.mapId==='relay')for(const rack of MAPS[this.mapId].pickups)if(overlapsStand({x:p.x,y:floor,z:p.z},rack))floor=Math.max(floor,rack.y+(this.mapId==='dunes'?.22:0));
      position={x:p.x,y:floor,z:p.z};
    }
    const id=`dropped-${this.matchId}-${++this.droppedGunId}`;
    this.pickups.push({id,weapon,...position,availableAt:this.time,dropped:true,ammo:p.ammo[weapon]??0,yaw});
    if(this.moreFun)this.droppedFlowers.set(id,{flower:!!this.flowerInventory.get(p.id)?.has(weapon),revealed:!!p.flowerWeapons?.includes(weapon),untested:!!p.untestedWeapons?.includes(weapon)});
  }
  private dropGuns(p:Player){this.dropGun(p,p.primary);this.dropGun(p,p.secondary??'pistol',-1);}
  pickup(p:Player){
    if(p.grenadeThrow&&!p.grenadeThrow.released)return;
    const pickup=nearestPickup(p,this.pickups,this.time,this.solids);if(!pickup)return;
    const previous=isSidearm(pickup.weapon)?p.secondary??'pistol':p.primary;
    this.dropGun(p,previous);
    if(Object.hasOwn(freshAmmo(),previous))p.ammo[previous]=0;else delete p.ammo[previous];
    if(isSidearm(pickup.weapon))p.secondary=pickup.weapon;else p.primary=pickup.weapon;
    const dropped=this.droppedFlowers.get(pickup.id),flowers=this.flowerInventory.get(p.id)??new Set();flowers.delete(previous);flowers.delete(pickup.weapon);if(this.flowerRacks.has(pickup.id)||dropped?.flower)flowers.add(pickup.weapon);this.flowerInventory.set(p.id,flowers);
    p.untestedWeapons=this.moreFun?[...(p.untestedWeapons??[]).filter(w=>w!==previous&&w!==pickup.weapon),...(!isSidearm(pickup.weapon)&&(!pickup.dropped||dropped?.untested)?[pickup.weapon]:[])]:undefined;
    p.flowerWeapons=[...(p.flowerWeapons??[]).filter(w=>w!==previous&&w!==pickup.weapon),...(dropped?.revealed?[pickup.weapon]:[])];
    p.weapon=pickup.weapon;p.ammo[p.weapon]=pickup.dropped?Math.max(0,Math.min(WEAPONS[p.weapon].magazine,pickup.ammo??0)):WEAPONS[p.weapon].magazine;p.reloadUntil=0;p.scope=undefined;
    this.pickups=this.pickups.filter(p=>p.id!==pickup.id);this.droppedFlowers.delete(pickup.id);
    this.nextShot.set(p.id,this.time+300);
    this.emit('pickup',p,p.weapon,p,p,{target:p.id});
  }
  fire(p:Player){
    if(p.weapon==='grenade'||p.weapon==='bomb')return;
    if(isGun(p.weapon)){
      p.untestedWeapons=p.untestedWeapons?.filter(w=>w!==p.weapon);
      if(this.flowerInventory.get(p.id)?.has(p.weapon)){
        this.nextShot.set(p.id,this.time+WEAPONS[p.weapon].interval);p.protectedUntil=0;if(p.weapon!=='marksman')p.scope=undefined;
        if(!p.flowerWeapons?.includes(p.weapon)){p.flowerWeapons=[...(p.flowerWeapons??[]),p.weapon];this.emit('flower',p,p.weapon,this.eye(p),this.eye(p),{inputSeq:p.ack,spawnId:p.spawnId});}
        return;
      }
    }
    const w=p.weapon==='knife'?KNIFE:WEAPONS[p.weapon];if(isGun(p.weapon))p.ammo[p.weapon]=Math.max(0,(p.ammo[p.weapon]??0)-1);this.nextShot.set(p.id,this.time+w.interval);p.protectedUntil=0;if(p.weapon!=='marksman')p.scope=undefined;
    const from=this.eye(p),dir=direction(p.yaw,p.pitch);let distance=Math.min(p.weapon==='knife'?KNIFE.range:150,wallDistance(from,dir,this.solids)),target:Player|undefined,creature:Trex|undefined,companion:Dog|undefined,hitZone:HitZone|undefined;
    for(const other of this.players.values()){
      if(other.id===p.id||other.hp<=0)continue;
      const result=p.weapon==='knife'?null:rayPlayer(from,dir,other);
      const t=p.weapon==='knife'?rayBox(from,dir,{x:other.x-RADIUS,y:other.y,z:other.z-RADIUS},{x:other.x+RADIUS,y:other.y+heightOf(other),z:other.z+RADIUS}):result?.distance??null;
      if(t!==null&&t<distance){distance=t;target=other;hitZone=result?.zone;}
    }
    for(const trex of this.trexes){if(trex.hp<=0)continue;const hit=rayTrex(from,dir,trex);if(hit&&hit.distance<distance){distance=hit.distance;creature=trex;target=undefined;hitZone=hit.zone;}}
    for(const dog of this.dogs){if(dog.hp<=0)continue;const hit=rayDog(from,dir,dog);if(hit&&hit.distance<distance){distance=hit.distance;companion=dog;creature=undefined;target=undefined;hitZone=hit.zone;}}
    const to={x:from.x+dir.x*distance,y:from.y+dir.y*distance,z:from.z+dir.z*distance};
    const hit=target&&target.team!==p.team&&target.protectedUntil<=this.time?target:undefined;
    const surface=!target&&!creature&&!companion?impactTarget(from,dir,this.solids,p.weapon==='knife'?KNIFE.range:150):undefined;let impact:ImpactMark|undefined;
    if(surface){impact={...surface,id:++this.eventId,at:this.time,weapon:p.weapon,expiresAt:this.time+(p.weapon==='knife'?IMPACT_RULES.knifeLifetimeMs:IMPACT_RULES.bulletLifetimeMs)};this.impacts.push(impact);this.impacts=this.impacts.slice(-IMPACT_RULES.limit);}
    this.emit(p.weapon==='knife'?'melee':'shot',p,p.weapon,from,to,{inputSeq:p.ack,spawnId:p.spawnId,target:companion?.id??creature?.id??hit?.id,hitZone:companion||creature||hit?hitZone:undefined,impact});if(companion)this.damageDog(companion,w.damage*(hitZone==='head'?2:1),p,p.weapon,from,hitZone);else if(creature)this.damageTrex(creature,w.damage*(hitZone==='head'?2:1),p,p.weapon,from,hitZone);else if(hit)this.damage(hit,hitZone==='head'?hit.hp:w.damage,p,p.weapon,from,hitZone);
  }
  damage(victim:Player,amount:number,attacker:{id:string;team:Team},weapon:Equipment,from:Vec3,hitZone?:HitZone,cause?:CombatEvent['cause']){
    if(this.phase!=='playing'||victim.hp<=0||cause==='dog'&&victim.team===attacker.team||victim.protectedUntil>this.time&&cause!=='fall'&&cause!=='water'||victim.team===attacker.team&&victim.id!==attacker.id&&cause!=='trex')return;
    const dealt=Math.min(victim.hp,isGun(weapon)&&hitZone==='head'?victim.hp:Math.max(0,Math.round(amount))*PLAYER_HEALTH.damageScale);if(!dealt)return;victim.hp-=dealt;
    this.emit('damage',attacker,weapon,from,this.eye(victim),{target:victim.id,damage:dealt,hp:victim.hp,hitZone,cause});
    if(!victim.hp){
      this.dropGuns(victim);
      this.waterExposure.delete(victim.id);this.dropBomb(victim.id);victim.deaths++;victim.respawnAt=this.time+RESPAWN_MS;victim.death={at:this.time,from:{...from},vy:victim.vy,crouched:victim.crouched};victim.reloadUntil=0;victim.scope=undefined;victim.grenadeThrow=undefined;
      const killer=this.players.get(attacker.id);if(victim.team!==attacker.team){if(killer)killer.kills++;if(this.mode==='deathmatch')this.scores[attacker.team]++;}
      this.emit('kill',attacker,weapon,from,victim,{target:victim.id,name:cause==='trex'?'T-REX':killer?.name??'Departed player',victim:victim.name,victimTeam:victim.team,hitZone,cause});
      if(this.mode==='deathmatch'&&this.scores[attacker.team]>=WIN_SCORE)this.finish();
    }
  }
  damageTrex(trex:Trex,amount:number,attacker:{id:string;team:Team;name?:string},weapon:Equipment,from:Vec3,hitZone?:HitZone){
    if(this.phase!=='playing'||trex.hp<=0)return;const dealt=Math.min(trex.hp,Math.max(0,Math.round(amount)));if(!dealt)return;trex.hp-=dealt;
    this.emit('damage',attacker,weapon,from,{x:trex.x,y:trex.y+2.2,z:trex.z},{target:trex.id,damage:dealt,hp:trex.hp,hitZone});
    if(!trex.hp){trex.state='dead';trex.deadAt=this.time;trex.targetId=null;this.emit('trexDeath',attacker,weapon,trex,trex,{target:trex.id,name:attacker.name??this.players.get(attacker.id)?.name??(weapon==='bomb'?`${TEAMS[attacker.team].name} C4`:'Player'),victim:'T-REX',hitZone});}
  }
  damageDog(dog:Dog,amount:number,attacker:{id:string;team:Team},weapon:Equipment,from:Vec3,hitZone?:HitZone){
    if(this.phase!=='playing'||dog.hp<=0||attacker.team===dog.team)return;const dealt=Math.min(dog.hp,Math.max(0,Math.round(amount)));if(!dealt)return;dog.hp-=dealt;
    this.emit('damage',attacker,weapon,from,{x:dog.x,y:dog.y+.45,z:dog.z},{target:dog.id,damage:dealt,hp:dog.hp,hitZone});
    if(!dog.hp){dog.state='dead';dog.deadAt=this.time;dog.targetId=null;this.emit('dogDeath',attacker,weapon,dog,dog,{target:dog.id});}
  }
  private stepGrenadeThrows(){
    for(const p of this.players.values()){
      const action=p.grenadeThrow;if(!action)continue;
      if(p.hp<=0||!p.connected){p.grenadeThrow=undefined;continue;}
      if(action.releaseAt===undefined)continue;
      if(!action.released&&this.time+.001>=action.releaseAt){
        // Look direction can use the newest accepted input without advancing any
        // queued movement. Turning during the wind-up must not launch at old aim.
        const aim=this.queues.get(p.id)?.at(-1)??p;action.yaw=aim.yaw;action.pitch=aim.pitch;action.released=true;this.throwGrenade(p,true,action);
      }
      if(this.time+.001>=action.releaseAt+GRENADE_THROW.durationMs-GRENADE_THROW.releaseMs){
        p.grenadeThrow=undefined;
        if(p.weapon==='grenade'&&p.grenades===0){p.weapon=p.primary;p.reloadUntil=0;p.scope=undefined;this.nextShot.set(p.id,Math.max(this.nextShot.get(p.id)??0,this.time+200));}
      }
    }
  }
  throwGrenade(p:Player,reserved=false,aim?:{yaw?:number;pitch?:number}){
    if(!reserved){if(p.grenades<=0)return;p.grenades--;}p.protectedUntil=0;const eye=this.eye(p),yaw=aim?.yaw??p.yaw,d=direction(yaw,aim?.pitch??p.pitch),target={x:eye.x+d.x*.55+Math.cos(yaw)*.18,y:eye.y+d.y*.55-.12,z:eye.z+d.z*.55-Math.sin(yaw)*.18},offset={x:target.x-eye.x,y:target.y-eye.y,z:target.z-eye.z},length=Math.hypot(offset.x,offset.y,offset.z),ray={x:offset.x/length,y:offset.y/length,z:offset.z/length},distance=Math.max(0,Math.min(length,wallDistance(eye,ray,this.solids)-.09)),from={x:eye.x+ray.x*distance,y:eye.y+ray.y*distance,z:eye.z+ray.z*distance};
    const g:Grenade={id:++this.eventId,owner:p.id,team:p.team,...from,vx:d.x*17,vy:d.y*17+4.5,vz:d.z*17,explodeAt:this.time+GRENADE_THROW.fuseMs};
    this.grenades.push(g);this.emit('grenade',p,'grenade',from,from);
  }
  private stepGrenades(){
    for(const g of this.grenades){
      // Two fixed substeps bound travel below the thinnest gameplay wall width.
      for(let step=0;step<2;step++){
        g.vy-=16*DT/2;
        for(const [axis,v] of [['x','vx'],['y','vy'],['z','vz']] as const){
          const delta=g[v]*DT/2,before=g[axis];g[axis]+=delta;
          const blocked=()=>this.solids.some(b=>b.style!=='water'&&intersects({x:g.x,y:g.y-.12,z:g.z},b,.24,.12));
          if(blocked()){let lo=0,hi=1;for(let n=0;n<9;n++){const t=(lo+hi)/2;g[axis]=before+delta*t;if(blocked())hi=t;else lo=t;}g[axis]=before+delta*lo;g[v]*=-.48;}
        }
        const support=groundAt(g,this.solids,g.y),floor=(support===0&&g.y<0?MAPS[this.mapId].water?.bed??support:support)+.12;if(g.y<floor){g.y=floor;g.vy=Math.abs(g.vy)*.42;g.vx*=.8;g.vz*=.8;if(g.vy<.4)g.vy=0;}
      }
      if(this.time>=g.explodeAt){
        const source={id:g.owner,team:g.team};this.emit('explosion',source,'grenade',g,g);
        for(const p of this.players.values()){
          const centre={x:p.x,y:p.y+heightOf(p)/2,z:p.z};const dx=centre.x-g.x,dy=centre.y-g.y,dz=centre.z-g.z,d=Math.hypot(dx,dy,dz);
          if(d<GRENADE_BLAST.radius&&(d<.01||wallDistance(g,{x:dx/d,y:dy/d,z:dz/d},this.solids)>=d-.05))this.damage(p,grenadeBlastDamage(d),source,'grenade',g);
        }
        for(const dog of this.dogs){if(dog.hp<=0)continue;const centre={x:dog.x,y:dog.y+.4,z:dog.z},dx=centre.x-g.x,dy=centre.y-g.y,dz=centre.z-g.z,d=Math.hypot(dx,dy,dz);if(d<GRENADE_BLAST.radius&&(d<.01||wallDistance(g,{x:dx/d,y:dy/d,z:dz/d},this.solids)>=d-.05))this.damageDog(dog,grenadeBlastDamage(d),source,'grenade',g);}
        for(const trex of this.trexes){if(trex.hp<=0)continue;const centre={x:trex.x,y:trex.y+1.5,z:trex.z},dx=centre.x-g.x,dy=centre.y-g.y,dz=centre.z-g.z,d=Math.hypot(dx,dy,dz);if(d<GRENADE_BLAST.radius&&(d<.01||wallDistance(g,{x:dx/d,y:dy/d,z:dz/d},this.solids)>=d-.05))this.damageTrex(trex,grenadeBlastDamage(d),source,'grenade',g);}
      }
    }
    this.grenades=this.grenades.filter(g=>this.time<g.explodeAt);
  }
  disconnect(id:string){const p=this.players.get(id);if(p){p.connected=false;p.grenadeThrow=undefined;}this.dropBomb(id);this.bombIntents.delete(id);}
  private resetBomb(){
    this.bombs=(['red','blue'] as Team[]).map(team=>{
      const carrier=[...this.players.values()].find(p=>p.team===team&&p.connected&&p.hp>0);
      return {...MAPS[this.mapId].spawns[team][0],team,status:carrier?'carried':'dropped',carrierId:carrier?.id??null,siteId:null,explodeAt:0,action:null};
    });
  }
  private dropBomb(id:string){
    const bomb=this.bombs.find(b=>b.status==='carried'&&b.carrierId===id);if(!bomb)return;
    const p=this.players.get(id);if(p){let y=groundAt(p,this.solids,p.y+.01);for(const b of this.solids)if(footprint(p,b,0)&&solidTop(b,p)<=p.y+.01)y=Math.max(y,solidTop(b,p));Object.assign(bomb,{x:p.x,y,z:p.z});if(p.weapon==='bomb')p.weapon=p.primary;}
    bomb.status='dropped';bomb.carrierId=null;bomb.action=null;
  }
  private finishBomb(winner:Team|'draw',outcome:string){if(this.phase==='finished')return;this.phase='finished';this.scheduleNextGame();this.winner=winner;this.outcome=outcome;if(winner!=='draw')this.scores[winner]++;for(const bomb of this.bombs)bomb.action=null;}
  private stepBomb(){
    // Resolve every fuse before actions, independent of team/player order. An
    // exact simultaneous detonation is a draw; a fuse wins a defuse-time tie.
    const due=this.bombs.filter(b=>b.status==='planted'&&this.time+.001>=b.explodeAt).sort((a,b)=>a.explodeAt-b.explodeAt);
    if(due.length){
      const first=due.filter(b=>Math.abs(b.explodeAt-due[0].explodeAt)<.001);
      for(const bomb of first){bomb.status='exploded';this.emit('explosion',{id:`C4-${bomb.team}`,team:bomb.team},'bomb',bomb,bomb);
        for(const p of this.players.values())if(p.hp>0&&Math.hypot(p.x-bomb.x,p.y-bomb.y,p.z-bomb.z)<18){const hp=Math.max(0,p.hp-Math.round(500*(1-Math.hypot(p.x-bomb.x,p.y-bomb.y,p.z-bomb.z)/18)));this.emit('damage',{id:`C4-${bomb.team}`,team:bomb.team},'bomb',bomb,p,{target:p.id,damage:p.hp-hp,hp});if(hp===0){p.deaths++;p.death={at:this.time,from:{x:bomb.x,y:bomb.y,z:bomb.z},vy:p.vy,crouched:p.crouched};p.respawnAt=this.time+RESPAWN_MS;this.emit('kill',{id:bomb.planter?.id??`C4-${bomb.team}`,team:bomb.team},'bomb',bomb,p,{target:p.id,name:bomb.planter?.name??`${TEAMS[bomb.team].name} C4`,victim:p.name,victimTeam:p.team});}p.hp=hp;}
      }
      for(const bomb of first)for(const trex of this.trexes){const d=Math.hypot(trex.x-bomb.x,trex.y-bomb.y,trex.z-bomb.z);if(d<18)this.damageTrex(trex,Math.round(500*(1-d/18)),{id:bomb.planter?.id??`C4-${bomb.team}`,team:bomb.team,name:bomb.planter?.name},'bomb',bomb);}
      for(const bomb of first)for(const dog of this.dogs){const d=Math.hypot(dog.x-bomb.x,dog.y-bomb.y,dog.z-bomb.z);if(d<18)this.damageDog(dog,Math.round(500*(1-d/18)),{id:bomb.planter?.id??`C4-${bomb.team}`,team:bomb.team},'bomb',bomb);}
      this.finishBomb(first.length>1?'draw':first[0].team,first.length>1?'Both sites detonated simultaneously':`${TEAMS[first[0].team].name} C4 detonated at ${first[0].siteId}`);return;
    }
    for(const bomb of this.bombs){
      const carrier=bomb.carrierId?this.players.get(bomb.carrierId):undefined;
      if(bomb.status==='carried'&&(!carrier||!carrier.connected||carrier.hp<=0))this.dropBomb(bomb.carrierId!);
      if(bomb.status==='carried'&&carrier)Object.assign(bomb,{x:carrier.x,y:carrier.y,z:carrier.z});
      const candidates=[...this.players.values()].filter(p=>{
        const intent=this.bombIntents.get(p.id);if(!intent||this.time-intent.at>150||!p.connected||p.hp<=0||!p.grounded||!!p.grenadeThrow)return false;
        const i=intent.input;if(i.forward||i.strafe||i.jump||i.reload)return false;
        if(bomb.status==='carried')return p.team===bomb.team&&bomb.carrierId===p.id&&p.weapon==='bomb'&&i.weapon==='bomb'&&i.fire&&!!plantSite(p,this.mapId,p.team);
        return bomb.status==='planted'&&p.team!==bomb.team&&i.interact&&!i.fire&&canReachBomb(p,bomb,this.solids);
      });
      const actor=candidates.find(p=>p.id===bomb.action?.playerId)??candidates[0];
      if(!actor)bomb.action=null;
      else{
        const kind=bomb.status==='carried'?'plant':'defuse';
        if(bomb.action?.playerId!==actor.id||bomb.action.kind!==kind){bomb.action={kind,playerId:actor.id,startedAt:this.time,completeAt:this.time+(kind==='plant'?BOMB_RULES.plantMs:BOMB_RULES.defuseMs)};this.emit('bombAction',actor,'bomb',actor,actor);}
        if(this.time+.001>=bomb.action.completeAt){
          if(kind==='plant'){const site=plantSite(actor,this.mapId,actor.team)!;Object.assign(bomb,{status:'planted',carrierId:null,planter:{id:actor.id,name:actor.name},siteId:site.id,x:actor.x,y:actor.y,z:actor.z,explodeAt:this.time+BOMB_RULES.fuseMs,action:null});actor.weapon=actor.primary;this.emit('bombPlant',actor,'bomb',bomb,bomb);}
          else{bomb.status='defused';bomb.action=null;this.emit('bombDefuse',actor,'bomb',bomb,bomb);}
        }
      }
    }
    if(this.bombs.every(b=>b.status==='defused')){this.finishBomb('draw','Both C4 charges defused');return;}
    const connected=[...this.players.values()].filter(p=>p.connected);
    if(connected.length===1&&connected[0].hp<=0&&connected[0].death){this.finishBomb('draw','Solo player died');return;}
    if(this.roundLive){
      const alive=(team:Team)=>[...this.players.values()].some(p=>p.team===team&&p.hp>0&&p.connected);
      const red=alive('red'),blue=alive('blue');
      if(!red&&!blue&&!this.bombs.some(b=>b.status==='planted'))this.finishBomb('draw','Both teams eliminated');
      else if(!red&&blue&&!this.bombs.some(b=>b.team==='red'&&b.status==='planted'))this.finishBomb('blue','Team A eliminated');
      else if(!blue&&red&&!this.bombs.some(b=>b.team==='blue'&&b.status==='planted'))this.finishBomb('red','Team B eliminated');
    }
  }
  private scheduleNextGame(){this.nextRoundAt=this.time+NEXT_GAME_COUNTDOWN_MS+(this.bombs.some(b=>b.status==='exploded')?BOMB_RESULT_DELAY_MS:0);}
  finish(){if(this.phase==='finished')return;this.phase='finished';this.scheduleNextGame();this.winner=this.scores.red===this.scores.blue?'draw':this.scores.red>this.scores.blue?'red':'blue';}
  rematch(){if(this.phase!=='finished')return;this.wildlife.clear();this.companions.clear();this.round++;this.sprays=[];this.impacts=[];if(this.mode==='deathmatch')this.scores={red:0,blue:0};this.phase='playing';this.nextRoundAt=0;this.winner=null;this.endsAt=this.mode==='defusal'?0:this.time+ROUND_MS;this.roundLive=false;this.outcome='';this.bombIntents.clear();this.grenades=[];this.pickups=MAPS[this.mapId].pickups.map(p=>({...p}));this.droppedFlowers.clear();this.flowerRacks=this.moreFun?flowerPickupIds(this.pickups):new Set();for(const p of this.players.values()){p.dogUsed=undefined;p.kills=0;p.deaths=0;this.spawn(p);}if(this.mode==='defusal')this.resetBomb();}
  changeMap(mapId:MapId):Simulation {
    if(mapId===this.mapId)return this;
    return this.newGame(mapId);
  }
  randomizeTeams(choose?:(max:number)=>number):Simulation {
    return this.newGame(this.mapId,assignRandomTeams(this.players.values(),choose));
  }
  private newGame(mapId:MapId,teams?:ReadonlyMap<string,Team>):Simulation {
    const next=new Simulation(mapId,this.mode,this.teamAvatars,this.moreFun);
    next.time=this.time;next.round=this.round+1;next.eventId=this.eventId;next.endsAt=this.mode==='defusal'?0:this.time+ROUND_MS;
    for(const old of this.players.values()){
      const player=next.add(old.id,old.name);
      player.team=teams?.get(old.id)??old.team;player.connected=old.connected;player.spawnId=old.spawnId;
      const sequence=Math.max(old.ack,this.lastSeq.get(old.id)??0);player.ack=sequence;next.lastSeq.set(old.id,sequence);
      next.spawn(player);
    }
    if(next.mode==='defusal')next.resetBomb();
    return next;
  }
  snapshot():Snapshot{return{dogs:this.dogs.length?this.dogs.map(d=>({...d})):undefined,teamAvatars:{...this.teamAvatars},trexes:this.trexes.map(t=>({...t})),impacts:this.impacts.map(m=>({...m,position:{...m.position},normal:{...m.normal},ray:{origin:{...m.ray.origin},direction:{...m.ray.direction}}})),sprays:this.sprays.map(s=>({...s,position:{...s.position},normal:{...s.normal},ray:s.ray?{origin:{...s.ray.origin},direction:{...s.ray.direction}}:undefined})),mode:this.mode,roundLive:this.roundLive,outcome:this.outcome,bomb:this.bomb?{...this.bomb,planter:this.bomb.planter?{...this.bomb.planter}:undefined,action:this.bomb.action?{...this.bomb.action}:null}:null,bombs:this.bombs.map(b=>({...b,planter:b.planter?{...b.planter}:undefined,action:b.action?{...b.action}:null})),mapId:this.mapId,matchId:this.matchId,round:this.round,time:this.time,endsAt:this.endsAt,nextRoundAt:this.nextRoundAt,phase:this.phase,winner:this.winner,scores:{...this.scores},players:[...this.players.values()].map(p=>({...p,gunState:Math.max(0,Math.ceil(((this.nextShot.get(p.id)??0)-this.time-.01)/(DT*1000)))*2+(this.trigger.get(p.id)?1:0),death:p.death?{...p.death,from:{...p.death.from}}:undefined,grenadeThrow:p.grenadeThrow?{...p.grenadeThrow}:undefined,ammo:{...p.ammo},untestedWeapons:p.untestedWeapons?[...p.untestedWeapons]:undefined,flowerWeapons:p.flowerWeapons?[...p.flowerWeapons]:undefined})),pickups:this.pickups.map(({base,...p})=>p),grenades:this.grenades.map(g=>({...g}))};}
}
