import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MAPS,ISLAND_COAST,ISLAND_WATER,ISLAND_SEABED,ISLAND_SIZE,WATER_RULES,fullySubmerged,inWater,groundAt,solidTop,move,neutralInput,intersects,wallDistance,impactTarget,type Motion,type Player,type CombatEvent} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {surfaceAt} from '../apps/web/components/combat-audio';
import {RECORDED_AUDIO} from '../apps/web/components/recorded-audio';
import {IslandSharks} from '../apps/web/components/island-sharks';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {killDescription} from '../apps/web/components/KillFeed';
const map=MAPS.island,deep={x:ISLAND_COAST[0][0]*1.28,z:ISLAND_COAST[0][1]*1.28,y:ISLAND_WATER.bed};
function tick(s:Simulation,n:number){const events:CombatEvent[]=[];for(let i=0;i<n;i++){s.step();events.push(...s.events);}return events;}
function diver(mode:'deathmatch'|'defusal'='deathmatch'){const s=new Simulation('island',mode),p=s.add('a','Diver');Object.assign(p,deep,{grounded:true,protectedUntil:1e9});return {s,p};}
const waterDamage=(e:CombatEvent[])=>e.filter(e=>e.type==='damage'&&e.cause==='water');
test('submersion uses the whole standing or crouched body rather than eye or foot height',()=>{
 assert.equal(inWater({...deep,y:-.34},map.water),true);assert.equal(fullySubmerged({...deep,y:-.34},map.water),false);
 assert.equal(fullySubmerged({...deep,y:-2.04},map.water),false);assert.equal(fullySubmerged({...deep,y:-2.05},map.water),true);
 assert.equal(fullySubmerged({...deep,y:-1.34,crouched:true},map.water),false);assert.equal(fullySubmerged({...deep,y:-1.36,crouched:true},map.water),true);
 assert.equal(fullySubmerged(deep,undefined),false);assert.equal(WATER_RULES.breathMs,10000);
});
test('no HP is lost during the first ten seconds underwater; subsequent loss is gradual, authoritative and ignores protection',()=>{
 const {s,p}=diver();assert.equal(fullySubmerged(p,map.water),true);const first=tick(s,300);assert.equal(p.hp,100);assert.equal(waterDamage(first).length,0);
 const next=tick(s,31);assert.equal(p.hp,95);assert.equal(waterDamage(next).length,1);assert.equal(waterDamage(next)[0].damage,5);
 const more=tick(s,90);assert.equal(p.hp,80);assert.equal(waterDamage(more).length,3);assert.equal(p.kills,0);assert.deepEqual(s.scores,{red:0,blue:0});
});
test('wading has no time limit and exposing any part of the body resets the full-submersion timer',()=>{
 const {s,p}=diver();tick(s,250);const coast=ISLAND_COAST[0],shallow={x:coast[0]*1.06,z:coast[1]*1.06};Object.assign(p,shallow,{y:groundAt(shallow,map.solids),crouched:false});assert.equal(inWater(p,map.water),true);assert.equal(fullySubmerged(p,map.water),false);tick(s,1500);assert.equal(p.hp,100);
 Object.assign(p,deep);tick(s,300);assert.equal(p.hp,100);tick(s,31);assert.equal(p.hp,95);
 s.spawn(p);tick(s,10);Object.assign(p,deep);tick(s,300);assert.equal(p.hp,100,'respawn restores a full breath');
 s.finish();s.rematch();Object.assign(p,deep);tick(s,300);assert.equal(p.hp,100,'new games clear prior exposure');
 s.remove(p.id);const replacement=s.add('a','Replacement');Object.assign(replacement,deep);tick(s,300);assert.equal(replacement.hp,100,'seat reuse clears exposure');
});
test('drowning uses normal death and C4 rules, with no self-awarded kill or score',()=>{
 for(const mode of ['deathmatch','defusal'] as const){const {s,p}=diver(mode);if(mode==='defusal')s.add('b','Opponent');p.hp=5;const events=tick(s,332),kill=events.find(e=>e.type==='kill'&&e.cause==='water');assert.ok(kill);assert.equal(p.hp,0);assert.equal(p.deaths,1);assert.equal(p.kills,0);assert.equal(killDescription(kill).method,'DROWNED');if(mode==='defusal'){assert.equal(s.phase,'finished');assert.equal(s.winner,'blue');assert.ok(s.bombs.find(b=>b.team===p.team)!.y< -2.6,'dropped C4 settles on the seabed');}else{assert.deepEqual(s.scores,{red:0,blue:0});tick(s,160);assert.equal(p.hp,100);assert.ok(p.y>=0);}}
});
test('all shores can be waded down and walked back out, without hidden walls or underwater floor snapping',()=>{
 for(const index of [0,8,16,24,32,40,48,56]){
  const a=ISLAND_COAST[index],angle=Math.atan2(a[1],a[0]),dx=Math.cos(angle),dz=Math.sin(angle);let p:Motion={x:a[0]*.97,y:0,z:a[1]*.97,vy:0,grounded:true};let lowest=0;
  for(let i=0;i<115;i++){p=move(p,{...neutralInput(),yaw:Math.atan2(-dx,-dz),forward:1},map.solids);lowest=Math.min(lowest,p.y);assert.equal(map.solids.some(b=>intersects(p,b)),false);}
  assert.ok(lowest< -2.6,`shore ${index} reaches deep water`);assert.ok(fullySubmerged(p,map.water));
  for(let i=0;i<115;i++)p=move(p,{...neutralInput(),yaw:Math.atan2(dx,dz),forward:1},map.solids);
  assert.equal(p.y,0,`shore ${index} can be exited without a jump`);assert.equal(p.grounded,true);
 }
 for(const b of ISLAND_SEABED){assert.ok(solidTop(b,b)<0);assert.ok(Math.abs(groundAt({x:b.x,z:b.z},[b])-solidTop(b,b))<1e-6);}
});
test('underwater rays hit the seabed and island instead of a phantom plane above the player',()=>{
 assert.ok(wallDistance({...deep,y:-1},{x:0,y:0,z:1},map.solids)>0);const hit=impactTarget({...deep,y:-1},{x:0,y:-1,z:0},map.solids);assert.ok(hit);assert.ok(Math.abs(hit.position.y-ISLAND_WATER.bed)<1e-6);assert.ok(Math.abs(wallDistance({...deep,y:-1},{x:0,y:-1,z:0},map.solids)-1.72)<1e-6);
 const fromAbove=impactTarget({...deep,y:4},{x:0,y:-1,z:0},map.solids);assert.ok(fromAbove);assert.ok(fromAbove.position.y< -2.6);
 const from={x:0,y:2,z:0},direction={x:0,y:-Math.SQRT1_2,z:Math.SQRT1_2},distantWall={x:0,y:0,z:8,w:4,h:20,d:1,kind:'wall' as const};
 const fallback=impactTarget(from,direction,[distantWall]);assert.ok(fallback);assert.equal(fallback.position.y,0,'unmodelled ground still blocks a farther wall');assert.equal(fallback.surface,'sand');
});
test('grenades thrown underwater fall to the seabed rather than bouncing on an invisible surface',()=>{
 const {s,p}=diver();p.pitch=-1;assert.equal(p.grenades,2);s.throwGrenade(p);const events=tick(s,70),explosion=events.find(e=>e.type==='explosion');assert.ok(explosion);assert.ok(explosion.from.y< -2.4);assert.ok(explosion.from.y>=ISLAND_WATER.bed+.119);assert.equal(p.grenades,1);
});
test('water footstep material stays distinct from beach and rocks and uses four recorded splash takes',()=>{
 assert.equal(surfaceAt(deep,map.solids,map.water),'water');assert.equal(surfaceAt({...deep,y:-.34},map.solids,map.water),'water');assert.equal(surfaceAt({x:0,y:0,z:11},map.solids,map.water),'grit');assert.equal(RECORDED_AUDIO['step-water']?.length,4);assert.notDeepEqual(RECORDED_AUDIO['step-water'],RECORDED_AUDIO['step-grit']);
});
test('reef sharks appear occasionally underwater, remain in deep water and disappear when surfacing',()=>{
 const materials:THREE.Material[]=[],art={material:(color:string,options:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial({color,...options});materials.push(m);return m;}} as unknown as WorldArt;
 const sharks=new IslandSharks(art),camera=new THREE.Vector3(deep.x,deep.y+1.6,deep.z);
 try{sharks.update(0,camera,false);assert.equal(sharks.root.visible,false);sharks.update(10,camera,true);assert.equal(sharks.root.visible,false);sharks.update(3600,camera,true);assert.equal(sharks.root.visible,true);const before=sharks.root.position.clone();sharks.update(6000,camera,true);assert.ok(sharks.root.position.distanceTo(before)>1);assert.ok(sharks.root.position.y<ISLAND_WATER.level-.5);assert.ok(Math.hypot(sharks.root.position.x/ISLAND_SIZE.x,sharks.root.position.z/ISLAND_SIZE.z)>1.2);sharks.update(18000,camera,true);assert.equal(sharks.root.visible,false);sharks.update(37000,camera,true);assert.equal(sharks.root.visible,true);sharks.update(37500,camera,false);assert.equal(sharks.root.visible,false);sharks.reset();assert.equal(sharks.root.visible,false);}finally{disposeGroup(sharks.root);for(const m of materials)m.dispose();}
});
