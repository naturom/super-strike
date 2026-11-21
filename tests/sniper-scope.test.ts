import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {neutralInput} from '@sirocco/shared';
import {SniperScope,BASE_FOV,SCOPE_POWER,scopeFov,type ScopeContext,type ScopeLevel} from '../apps/web/components/sniper-scope';
const ready:ScopeContext={weapon:'marksman',alive:true,locked:true,reloading:false,sprinting:false,playing:true};
test('right-click cycles sniper scope through 3x, 8x and normal view',()=>{
 const scope=new SniperScope();assert.equal(scope.level,0);
 assert.equal(scope.cycle(ready),1);assert.equal(scope.cycle(ready),2);assert.equal(scope.cycle(ready),0);
 for(const level of [0,1,2] as ScopeLevel[]){const actual=Math.tan(BASE_FOV*Math.PI/360)/Math.tan(scopeFov(level)*Math.PI/360);assert.ok(Math.abs(actual-SCOPE_POWER[level])<1e-9);assert.ok(scopeFov(level)>0);}
});
test('scope cancels on equipment change, reload, sprint, death, mouse release or round end',()=>{
 for(const change of [{weapon:'rifle'},{weapon:'pistol'},{weapon:'knife'},{weapon:'grenade'},{weapon:'bomb'},{reloading:true},{sprinting:true},{alive:false},{locked:false},{playing:false}] as Partial<ScopeContext>[]){
  const scope=new SniperScope();scope.cycle(ready);assert.equal(scope.sync({...ready,...change}),0);assert.equal(scope.cycle({...ready,...change}),0);assert.equal(scope.sync(ready),0,'scope must not resume by itself');
 }
});
test('explicit room lifecycle reset leaves no stale zoom',()=>{
 const scope=new SniperScope();scope.cycle(ready);scope.cycle(ready);scope.reset();assert.equal(scope.level,0);assert.equal(scopeFov(scope.level),BASE_FOV);assert.equal(scope.cycle(ready),1);
});

// The server snapshot drives the same scoped view for spectators.
test('AWP retains either zoom level through the shot, bolt cycle and following shot',()=>{
 for(const level of [1,2] as const){const sim=new Simulation('relay','deathmatch',undefined,false),p=sim.add('sniper','Sniper');p.weapon=p.primary='marksman';p.ammo.marksman=8;sim.time+=1000;
  sim.input(p.id,{...neutralInput(),seq:1,weapon:'marksman',scope:level,fire:true});sim.step();assert.equal(p.ammo.marksman,7);assert.equal(p.scope,level);assert.equal(sim.events.some(e=>e.type==='shot'),true);
  for(let tick=0;tick<20;tick++)sim.step();assert.equal(sim.snapshot().players.find(p=>p.id==='sniper')!.scope,level);
  sim.input(p.id,{...neutralInput(),seq:2,weapon:'marksman',scope:level,fire:false});sim.step();sim.time+=1000;sim.input(p.id,{...neutralInput(),seq:3,weapon:'marksman',scope:level,fire:true});sim.step();assert.equal(p.ammo.marksman,6);assert.equal(p.scope,level);
 }
});
