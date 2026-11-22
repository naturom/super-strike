import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GUNS,MAPS,WEAPONS,isSidearm,neutralInput,type Player,type Weapon} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {flowerPickupIds} from '../apps/server/src/flower-guns';
import {ShotFeedback} from '../apps/web/components/shot-feedback';
import {updateWeaponFlower} from '../apps/web/components/flower-gun';
import {WorldArt,disposeGroup} from '../apps/web/components/world';

function findFlower(){
 const sim=new Simulation('dunes'),player=sim.add('a','Gardener');sim.solids=[];
 for(const rack of sim.pickups.filter(p=>p.base==='red')){
  Object.assign(player,{x:rack.x,y:rack.y,z:rack.z});sim.pickup(player);sim.events=[];sim.fire(player);
  if(sim.events.some(e=>e.type==='flower'))return {sim,player,rack};
 }
 throw Error('Base is missing its flower gun');
}
test('each map selects one primary gun per base, excluding all pistols and central racks',()=>{
 for(const map of Object.values(MAPS)){
  for(const team of ['red','blue'])assert.ok(map.pickups.filter(p=>p.base===team).length>1);
  for(const choose of [(n:number)=>0,(n:number)=>n-1]){
   const ids=flowerPickupIds(map.pickups,choose);assert.equal(ids.size,2);
   for(const team of ['red','blue'])assert.equal(map.pickups.filter(p=>p.base===team&&ids.has(p.id)).length,1);
   assert.ok(map.pickups.filter(p=>!p.base).every(p=>!ids.has(p.id)));
   assert.ok(map.pickups.filter(p=>ids.has(p.id)).every(p=>!isSidearm(p.weapon)));
  }
  const first=flowerPickupIds(map.pickups,()=>0),last=flowerPickupIds(map.pickups,n=>n-1);assert.ok([...first].every(id=>!last.has(id)));
  const eligible=map.pickups.filter(p=>p.base&&!isSidearm(p.weapon)),seen=new Set<string>();
  for(let i=0;i<eligible.length;i++)for(const id of flowerPickupIds(map.pickups,n=>i%n))seen.add(id);
  assert.deepEqual([...seen].sort(),eligible.map(p=>p.id).sort());
 }
});
test('rack and inventory snapshots keep the surprise hidden until firing; exactly one gun per base blooms',()=>{
 for(const mapId of ['dunes','relay'] as const){
  const s=new Simulation(mapId),p=s.add('a','Tester');s.solids=[];
  assert.deepEqual(s.snapshot().pickups,MAPS[mapId].pickups.map(({base,...rack})=>rack),'no secret markers on racks');
  for(const team of ['red','blue']){
   let flowers=0;
   for(const rack of s.pickups.filter(p=>p.base===team)){
    s.spawn(p);Object.assign(p,{x:rack.x,y:rack.y,z:rack.z});s.pickup(p);
    const before=s.snapshot().players[0];assert.deepEqual(before.untestedWeapons,isSidearm(rack.weapon)?[]:[rack.weapon]);assert.ok(!before.flowerWeapons?.length);
    const magazine=p.ammo[rack.weapon];s.events=[];s.fire(p);
    assert.equal(p.untestedWeapons?.length,0);
    if(s.events.some(e=>e.type==='flower')){flowers++;assert.equal(p.ammo[rack.weapon],magazine);assert.deepEqual(p.flowerWeapons,[rack.weapon]);assert.equal(s.events.length,1);}
    else{assert.equal(s.events[0].type,'shot');assert.equal(p.ammo[rack.weapon],magazine!-1);}
   }
   assert.equal(flowers,1,`${mapId} ${team}`);
  }
 }
});
test('bases containing only pistols have no flower selection',()=>{
 const racks=[{id:'p12',base:'red' as const,weapon:'pistol' as const,x:0,y:0,z:0,availableAt:0},{id:'deagle',base:'blue' as const,weapon:'deagle' as const,x:2,y:0,z:0,availableAt:0}];
 assert.equal(flowerPickupIds(racks,()=>assert.fail('pistols must not enter the draw')).size,0);
});
test('pistols always fire bullets and predict normally after pickups and game resets',()=>{
 for(const map of ['dunes','relay'] as const){const sim=new Simulation(map),p=sim.add('a','Sidearm tester');sim.solids=[];
  for(let game=0;game<3;game++){
   for(const weapon of ['pistol','deagle'] as const){
    sim.spawn(p);sim.pickups=[{id:weapon+'-base',base:p.team,weapon,x:p.x,y:p.y,z:p.z,availableAt:0}];sim.pickup(p);
    assert.ok(!p.untestedWeapons?.includes(weapon));assert.ok(!p.flowerWeapons?.includes(weapon));
    const feedback=new ShotFeedback();feedback.sync({...p,gunState:0},sim.time,[]);assert.equal(feedback.predict({...neutralInput(),seq:1,spawnId:p.spawnId,weapon,fire:true},0),weapon);
    const ammo=p.ammo[weapon]!;sim.events=[];sim.fire(p);assert.equal(sim.events[0].type,'shot');assert.equal(p.ammo[weapon],ammo-1);assert.ok(!sim.events.some(e=>e.type==='flower'));
   }
   sim.phase='finished';sim.rematch();
  }
 }
});
test('a flower gun blooms once, never damages players, and makes no bullet marks or ammo loss',()=>{
 const {sim,player}=findFlower(),weapon=player.weapon as Weapon,victim=sim.add('b','Target');
 Object.assign(player,{x:0,y:0,z:0,yaw:0,pitch:0});Object.assign(victim,{x:0,y:0,z:-5,protectedUntil:0});
 const ammo=player.ammo[weapon];sim.events=[];
 for(let i=0;i<50;i++)sim.fire(player);
 assert.equal(victim.hp,100);assert.equal(player.ammo[weapon],ammo);assert.deepEqual(sim.events,[]);assert.deepEqual(sim.impacts,[]);
 sim.spawn(player);assert.equal(player.flowerWeapons,undefined);assert.equal(player.untestedWeapons,undefined);
 Object.assign(player,{x:0,y:0,z:0,yaw:0,pitch:0});sim.fire(player);assert.equal(victim.hp,0,'fresh normal rifle still fires');
});
test('flowers follow the picked weapon slot, clear on replacement, and reset with the game',()=>{
 const {sim,player}=findFlower(),flower=player.weapon as Weapon,other:Weapon=isSidearm(flower)?'rifle':'pistol';
 sim.pickups=[{id:'ordinary',x:player.x,y:player.y,z:player.z,weapon:other,availableAt:0}];sim.pickup(player);
 assert.ok(player.flowerWeapons?.includes(flower));sim.events=[];sim.fire(player);assert.equal(sim.events[0].type,'shot');
 player.weapon=flower;sim.events=[];sim.fire(player);assert.equal(sim.events.length,0);assert.ok(player.flowerWeapons?.includes(flower));
 sim.pickups=[{id:'replacement',x:player.x,y:player.y,z:player.z,weapon:flower,availableAt:0}];sim.pickup(player);assert.ok(!player.flowerWeapons?.includes(flower));sim.fire(player);assert.equal(sim.events.at(-1)?.type,'shot');
 sim.phase='finished';sim.rematch();assert.equal(player.flowerWeapons,undefined);assert.equal(player.untestedWeapons,undefined);assert.deepEqual(sim.snapshot().pickups,MAPS.dunes.pickups.map(({base,...rack})=>rack));
});
test('prediction never invents bullets before the server reveals a picked gun, or from revealed flowers',()=>{
 const sim=new Simulation([]),p=sim.add('a','Tester'),feedback=new ShotFeedback();sim.time=1000;
 const input={...neutralInput(),seq:1,spawnId:p.spawnId,fire:true};
 for(const flags of [{untestedWeapons:['rifle']},{flowerWeapons:['rifle']}]){
  const player={...p,...flags,gunState:0} as Player;feedback.sync(player,1000,[]);assert.equal(feedback.predict(input,0),undefined);
 }
 feedback.sync({...p,gunState:0},1000,[]);assert.equal(feedback.predict(input,0),'rifle');
});
test('all gun models keep a single animated flower rooted at the muzzle, including moving pistol slides',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})} as unknown as Document;
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{
  for(const kind of GUNS){
   const model=art.weapon(kind,false);model.traverse(o=>o.layers.set(1));updateWeaponFlower(model,false,0,art);assert.equal(model.getObjectByName('muzzle-flower'),undefined);
   updateWeaponFlower(model,true,100,art);const bloom=model.getObjectByName('muzzle-flower')!;assert.equal(bloom.parent,model.getObjectByName('muzzle'));bloom.traverse(o=>assert.equal(o.layers.mask,2,'flower inherits mirror visibility')); assert.ok(bloom.scale.x<.01);
   updateWeaponFlower(model,true,600,art);assert.equal(bloom.scale.x,1);
   const center=new THREE.Box3().setFromObject(bloom.getObjectByName('flower-center')!),petals=new THREE.Box3();bloom.children.filter(o=>o.name==='flower-petal').forEach(o=>petals.union(new THREE.Box3().setFromObject(o)));assert.ok(center.min.z<petals.min.z&&center.max.z>petals.max.z,'the centre protrudes in front of the petals from both viewing directions');
   const count=art.materials.length;updateWeaponFlower(model,true,900,art);assert.equal(art.materials.length,count,'no per-frame materials');
   model.position.set(2,3,4);model.rotation.set(.3,.4,.2);model.scale.setScalar(.75);model.updateMatrixWorld(true);assert.ok(bloom.getWorldPosition(new THREE.Vector3()).distanceTo(bloom.parent!.getWorldPosition(new THREE.Vector3()))<1e-8);
   updateWeaponFlower(model,false,1000,art);assert.equal(bloom.visible,false);disposeGroup(model);
  }
 }finally{art.destroy();globalThis.document=previous;}
});
