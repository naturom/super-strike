import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DOG_RULES,DEFAULT_TEAM_AVATARS,MAPS,neutralInput,validInput,intersects,rayDog,type Player,type Input,type Dog} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {TrexNavigation} from '../apps/server/src/trex-navigation';
import {WorldArt} from '../apps/web/components/world';
import {DogModels} from '../apps/web/components/dog-model';
import {dogBarkSignal} from '../apps/web/components/dog-audio';
function fixture(fun=true){const s=new Simulation([],'deathmatch',DEFAULT_TEAM_AVATARS,fun),a=s.add('a','Owner'),b=s.add('b','Enemy'),c=s.add('c','Ally');Object.assign(a,{x:0,y:0,z:8,yaw:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-3,protectedUntil:0});Object.assign(c,{x:1,y:0,z:8,protectedUntil:0});return {s,a,b,c};}
function send(s:Simulation,p:Player,patch:Partial<Input>={}){s.input(p.id,{...neutralInput(),seq:p.ack+1,weapon:p.weapon,...patch});s.step();}
function dog(s:Simulation,p:Player){send(s,p,{dog:true});assert.ok(s.dogs.length);return s.dogs.at(-1)!;}
test('dogs stay completely absent until deployment and More fun must be enabled',()=>{
 for(const fun of [true,false]){const {s,a}=fixture(fun);for(let i=0;i<30;i++)s.step();assert.equal(s.dogs.length,0);assert.equal(s.snapshot().dogs,undefined);send(s,a,{dog:true});assert.equal(s.dogs.length,fun?1:0);assert.equal(a.dogUsed,fun?true:undefined);}
 assert.equal(validInput({...neutralInput(),dog:true}),true);assert.equal(validInput({...neutralInput(),dog:'yes'}),false);
});
test('each player has one dog per game, with no recharge on death, respawn or reconnect',()=>{
 const {s,a,c}=fixture(),first=dog(s,a);assert.ok(Math.hypot(first.x-a.x,first.z-a.z)<3.8);assert.equal(first.owner,a.id);assert.equal(first.team,a.team);
 for(let i=0;i<10;i++)send(s,a,{dog:true});assert.equal(s.dogs.length,1);
 s.spawn(a);send(s,a,{dog:true});assert.equal(s.dogs.length,1);assert.equal(a.dogUsed,true);
 s.disconnect(a.id);a.connected=true;send(s,a,{dog:true});assert.equal(s.dogs.length,1);
 dog(s,c);assert.equal(s.dogs.length,2);s.remove(a.id);assert.ok(s.dogs.every(d=>d.owner!==a.id));
 s.phase='finished';s.rematch();assert.equal(s.dogs.length,0);assert.equal(c.dogUsed,undefined);Object.assign(c,{x:0,y:0,z:8,yaw:0});dog(s,c);assert.equal(s.dogs.length,1);
});
test('dogs seek only enemies and total bite damage stays light',()=>{
 const {s,a,b,c}=fixture(),d=dog(s,a);let hits=0;
 for(let i=0;i<600;i++){s.step();for(const e of s.events)if(e.type==='damage'&&e.cause==='dog'){hits++;assert.equal(e.target,b.id);assert.equal(e.damage,2.5);}}
 assert.equal(hits,3);assert.equal(b.hp,92.5);assert.equal(a.hp,100);assert.equal(c.hp,100);assert.equal(s.dogs.length,0);
 s.damage(a,5,{id:a.id,team:a.team},'knife',d,undefined,'dog');assert.equal(a.hp,100,'dog damage can never hit its owner, even if incorrectly requested');
});
test('dogs cannot bite through walls, hit elevated players or attack teammates',()=>{
 const {s,a,b,c}=fixture(),d=dog(s,a);Object.assign(d,{x:0,y:0,z:0});Object.assign(b,{x:0,y:0,z:-1});assert.equal(s.companions.canBite(d,b),true);
 Object.assign(c,{x:0,y:0,z:-.5});assert.equal(s.companions.canBite(d,c),false);Object.assign(b,{y:2});assert.equal(s.companions.canBite(d,b),false);b.y=0;
 s.solids=[{x:0,y:1,z:-.5,w:4,h:2,d:.15,kind:'wall'}];assert.equal(s.companions.canBite(d,b),false);
});
test('dogs navigate around cover without crossing collision walls',()=>{
 const {s,a,b}=fixture();s.solids=[{x:0,y:1.5,z:2,w:4,h:3,d:.3,kind:'wall'}];const d=dog(s,a);let around=false;
 for(let i=0;i<300&&s.dogs.length;i++){s.step();around ||= Math.abs(d.x)>2.2;assert.equal(s.solids.some(w=>intersects(d,w,DOG_RULES.height,DOG_RULES.radius)),false);}
 assert.ok(around);assert.ok(b.hp<100,'dog reaches the enemy by a clear route');
 const ceiling={x:0,y:1.5,z:0,w:4,h:.2,d:4,kind:'roof' as const},small=new TrexNavigation([ceiling],MAPS.relay,{radius:DOG_RULES.radius,height:DOG_RULES.height,cell:.8,maxStep:.4});
 assert.ok(small.point(0,0));assert.equal(new TrexNavigation([ceiling],MAPS.relay).point(0,0),undefined,'dog fits routes a dinosaur cannot');
});
test('enemies can stop a dog with gunfire, while friendly fire cannot hurt it',()=>{
 const {s,a,b}=fixture(),d=dog(s,a);Object.assign(d,{x:0,y:0,z:0,yaw:0});
 function aim(p:Player,z:number){Object.assign(p,{x:0,y:0,z,yaw:z>0?0:Math.PI,pitch:Math.atan2(.43-1.6,Math.abs(z)),protectedUntil:0});}
 aim(a,5);s.fire(a);assert.equal(d.hp,DOG_RULES.hp);aim(b,-5);s.fire(b);assert.ok(d.hp<DOG_RULES.hp);if(d.hp>0)s.fire(b);assert.equal(d.hp,0);assert.equal(d.state,'dead');assert.ok(s.events.some(e=>e.type==='dogDeath'));
 const score={...s.scores};for(let i=0;i<90;i++)s.step();assert.equal(s.dogs.length,0);assert.deepEqual(s.scores,score);
});
test('snapshots expose deployed dogs to all viewers without exposing one beforehand',()=>{
 const {s,a}=fixture(),d=dog(s,a),state=s.snapshot();assert.equal(state.dogs?.length,1);state.dogs![0].hp=0;assert.equal(d.hp,DOG_RULES.hp);assert.equal(state.players.find(p=>p.id===a.id)?.dogUsed,true);
});
test('dog rendering is lazy, animated, bounded, and grounded after death',()=>{
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];const scene=new THREE.Scene(),models=new DogModels(art,scene),d:Dog={id:'dog-test',owner:'a',team:'red',x:0,y:0,z:0,yaw:0,hp:35,state:'follow',targetId:null,attackAt:0,deadAt:0,expiresAt:22000};
 models.update([],0,1/60);assert.equal(scene.children.length,0);models.update([d],0,1/60);assert.equal(scene.children.length,1);const model=scene.children[0] as THREE.Group;
 let meshes=0;model.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});assert.ok(meshes<=24);assert.ok(new THREE.Box3().setFromObject(model).min.y>-.01);
 d.hp=20;models.update([d],50,1/60);assert.ok(Math.abs(model.userData.parts.healthFill.scale.x-20/35)<1e-8);assert.equal(model.userData.parts.health.visible,true);
 d.z=-.12;models.update([d],100,1/60);assert.ok(model.userData.parts.legs.some((leg:THREE.Group)=>Math.abs(leg.rotation.x)>.01));
 Object.assign(d,{hp:0,state:'dead',deadAt:100});for(const time of [150,350,700]){models.update([d],time,1/30);assert.ok(Math.abs(new THREE.Box3().setFromObject(model).min.y-.008)<1e-5);}
 models.update([],1000,1/60);assert.equal(scene.children.length,0);art.destroy();
 assert.ok(rayDog({x:0,y:.45,z:-4},{x:0,y:0,z:1},{...d,hp:35}));assert.equal(rayDog({x:2,y:.45,z:-4},{x:0,y:0,z:1},{...d,hp:35}),null);
 const bark=dogBarkSignal(12000);assert.ok(bark.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));assert.equal(bark[0],0);assert.equal(bark.at(-1),0);
});
