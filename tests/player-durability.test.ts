import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GUNS,WEAPONS,type CombatEvent} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
function duel(){const s=new Simulation([],'deathmatch',undefined,false),a=s.add('a','Attacker'),b=s.add('b','Defender');Object.assign(a,{x:0,y:0,z:3,yaw:0,pitch:Math.atan2(1.1-1.6,6),protectedUntil:0});Object.assign(b,{x:0,y:0,z:-3,protectedUntil:0});return {s,a,b};}
test('all guns require 200 points of base body damage while player health remains 0–100',()=>{
 for(const weapon of GUNS){const {s,a,b}=duel(),shots=Math.ceil(200/WEAPONS[weapon].damage);a.weapon=weapon;a.ammo[weapon]=100;assert.equal(b.hp,100);for(let n=1;n<shots;n++){s.fire(a);assert.equal(b.hp,100-n*WEAPONS[weapon].damage/2);assert.ok(b.hp>0,weapon);}s.fire(a);assert.equal(b.hp,0,weapon);assert.equal(b.deaths,1);assert.equal(a.kills,1);assert.equal(s.scores.red,1);}
});
test('odd damage amounts retain half points so small repeated hits also have exactly twice the tolerance',()=>{
 const {s,a,b}=duel();s.damage(b,5,a,'knife',a);assert.equal(b.hp,97.5);assert.equal(s.events.at(-1)?.damage,2.5);s.damage(b,5,a,'knife',a);assert.equal(b.hp,95);s.spawn(b);assert.equal(b.hp,100);assert.equal(s.snapshot().players.find(p=>p.id===b.id)?.hp,100);
});
test('explosions, falls, water and creature attacks share the same player durability',()=>{
 for(const cause of [undefined,'fall','water','trex','dog'] as (CombatEvent['cause']|undefined)[]){const {s,a,b}=duel();s.damage(b,20,a,cause==='fall'||cause==='water'?'knife':'grenade',a,undefined,cause);assert.equal(b.hp,90,String(cause));}const {s,a}=duel();s.damage(a,20,a,'grenade',a);assert.equal(a.hp,90,'self-inflicted blast damage is scaled too');
});
test('headshots remain instant at full or partial health and still respect friendly fire and protection',()=>{
 for(const hp of [100,87.5,.5]){const {s,a,b}=duel();b.hp=hp;s.damage(b,1,a,'pistol',a,'head');assert.equal(b.hp,0);assert.equal(b.deaths,1);assert.equal(s.events.find(e=>e.type==='damage')?.damage,hp);}
 for(const blocked of ['friendly','protected']){const {s,a,b}=duel();if(blocked==='friendly')b.team=a.team;else b.protectedUntil=1000;s.damage(b,200,a,'marksman',a,'head');assert.equal(b.hp,100);assert.equal(b.deaths,0);}
});
