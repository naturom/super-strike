import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Client,type Room} from '@colyseus/sdk';
import {CAVERNS as map,CAVE_PATCHES,CAVE_EDGES,CAVE_ROUTES,MAPS,validMap,intersects,groundAt,footprint,solidBottom,move,neutralInput,fullySubmerged,plantSite,impactTarget,wallDistance,type Motion,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {buildCaverns} from '../apps/web/components/cave-world';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {surfaceAt} from '../apps/web/components/combat-audio';
import {tourForMap} from '../apps/web/components/map-tour';
import {setCaveCutaway} from '../apps/web/components/cave-preview';
import {applyMapLighting} from '../apps/web/components/map-lighting';
import {createGameServer} from '../apps/server/src/http';

function fixture(check:(art:WorldArt)=>void){const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,context=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>context})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};let art:WorldArt|undefined;try{art=new WorldArt({capabilities:{getMaxAnisotropy:()=>4}} as unknown as THREE.WebGLRenderer);check(art);}finally{art?.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}}
test('cave spawns, supplies and both entire bomb sites are dry, grounded and unblocked',()=>{
 assert.equal(MAPS.caverns,map);assert.ok(validMap('caverns'));assert.equal(tourForMap('caverns').length,7);
 for(const p of [...map.spawns.red,...map.spawns.blue,...map.pickups]){assert.equal(groundAt(p,map.solids),p.y);assert.equal(map.solids.some(b=>intersects(p,b)),false,JSON.stringify(p));assert.equal(surfaceAt(p,map.solids,map.water),'stone');}
 for(const site of map.bombSites!)for(let x=site.x-3;x<=site.x+3;x+=.5)for(let z=-3;z<=3;z+=.5){const p={x,y:0,z};assert.equal(map.solids.some(b=>intersects(p,b)),false);assert.equal(plantSite(p,'caverns',site.id==='A'?'red':'blue')?.id,site.id);}
 for(const a of map.spawns.red)for(const b of map.spawns.blue){const d=Math.hypot(b.x-a.x,b.z-a.z);assert.ok(wallDistance({...a,y:1.6},{x:(b.x-a.x)/d,y:0,z:(b.z-a.z)/d},map.solids)<d,'rock columns block spawn-to-spawn fire');}
});
test('dry gallery, cathedral aisles and flooded tunnel can be walked both ways without falling, sticking or stairs',()=>{
 const routes=[CAVE_ROUTES[1],[[-32,5],[-23,18],[-14,21],[-5,21],[5,21],[23,17],[32,5]], [[-32,0],[-24,-3],[-20,1],[-17,2],[-13,2],[-5,3],[0,3.5],[5,3],[13,-2],[18,-2],[24,4],[32,0]],CAVE_ROUTES[3]];
 for(const [r,route] of routes.entries())for(const reverse of [false,true]){const points=reverse?[...route].reverse():route;let p:Motion={x:points[0][0],z:points[0][1],y:0,vy:0,grounded:true};p.y=groundAt(p,map.solids);let deep=false;
  for(const [x,z] of points.slice(1)){let steps=0;while(Math.hypot(x-p.x,z-p.z)>.2&&steps++<500){const old=p;p=move(p,{...neutralInput(),forward:1,sprint:true,yaw:Math.atan2(p.x-x,p.z-z)},map.solids);assert.ok(Math.abs(p.y-old.y)<.19,`smooth slope ${r}`);assert.ok(p.grounded,`grounded route ${r}`);assert.equal(map.solids.some(b=>intersects(p,b)),false,`no overlap ${r}`);deep ||= fullySubmerged(p,map.water);}assert.ok(steps<500,`route ${r} direction ${reverse} reached ${x},${z}`);}
  if(r===1){assert.ok(deep);assert.equal(p.y,0,'both flooded-route exits return to dry ground');}if(r===0)assert.equal(deep,false);
 }
});
test('cave shell is closed; floor and ceiling rays match shared geometry, including sloping submerged ceilings',()=>fixture(art=>{
 const root=buildCaverns(art);root.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 try{
  const edgeCounts=new Map<string,number>();for(const patch of CAVE_PATCHES)for(let i=0;i<3;i++){const key=[patch.points[i],patch.points[(i+1)%3]].map(p=>p.map(n=>n.toFixed(6)).join(',')).sort().join('|');edgeCounts.set(key,(edgeCounts.get(key)??0)+1);}assert.equal([...edgeCounts.values()].filter(n=>n===1).length,CAVE_EDGES.length);assert.ok([...edgeCounts.values()].every(n=>n===1||n===2));
  for(const patch of CAVE_PATCHES.filter((_,i)=>i%7===0)){
   const x=patch.points.reduce((a,p)=>a+p[0],0)/3,z=patch.points.reduce((a,p)=>a+p[1],0)/3,floor=patch.floor.reduce((a,b)=>a+b)/3,ceiling=Math.min(...map.solids.filter(b=>b.kind==='roof'&&footprint({x,z},b,0)).map(b=>solidBottom(b,{x,z}))),p={x,y:floor,z};if(map.solids.some(b=>b.kind==='wall'&&intersects(p,b)))continue;
   assert.ok(Math.abs(groundAt(p,map.solids)-floor)<1e-5);const roof=map.solids.find(b=>b.kind==='roof'&&b.polygon===patch.points)!;assert.ok(Math.abs(solidBottom(roof,p)-patch.ceiling.reduce((a,b)=>a+b)/3)<1e-5);assert.ok(ceiling-floor>2.7);
   for(const [y,dy,name,distance] of [[floor+.3,-1,'Cave floor',.3],[ceiling-.3,1,'Cave roof',.3]] as const){ray.set(new THREE.Vector3(x,y,z),new THREE.Vector3(0,dy,0));const hits=ray.intersectObject(root,true).filter(h=>h.object.name===name);assert.ok(hits.length);assert.ok(Math.abs(hits[0].distance-distance)<.00002,`rendered ${name}`);const hit=impactTarget({x,y,z},{x:0,y:dy,z:0},map.solids);assert.ok(hit);assert.ok(Math.abs(hit.position.y-(dy<0?floor:ceiling))<.00002,`authoritative ${name}`);}
  }
 }finally{disposeGroup(root);}
}));
test('cave water uses recorded splash footsteps, ten seconds of full-body breath and gradual HP loss',()=>{
 const s=new Simulation('caverns'),p=s.add('a','Cave diver');Object.assign(p,{x:3,z:22,y:groundAt({x:3,z:22},map.solids),protectedUntil:1e9,grounded:true});assert.ok(fullySubmerged(p,map.water));assert.equal(surfaceAt(p,map.solids,map.water),'water');
 for(let i=0;i<300;i++)s.step();assert.equal(p.hp,100);for(let i=0;i<31;i++)s.step();assert.equal(p.hp,95);Object.assign(p,map.spawns.red[0]);for(let i=0;i<300;i++)s.step();assert.equal(p.hp,95,'dry ground resets drowning exposure');
});
test('cave scenery stays within budget and switching back restores daylight',()=>fixture(art=>{
 const root=art.build('caverns');try{let draws=0,triangles=0,lights=0;root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}if(o instanceof THREE.PointLight){lights++;assert.equal(o.castShadow,false);}});assert.equal(lights,6);assert.ok(draws<=18,`${draws} draws`);assert.ok(triangles<25000,`${triangles} triangles`);}finally{disposeGroup(root);}
 const scene=new THREE.Scene(),view=new THREE.Scene(),sky=new THREE.Group(),sun=new THREE.DirectionalLight(),ambient=new THREE.HemisphereLight();sky.name='arenaSky';sun.name='arenaSun';ambient.name='arenaAmbient';scene.add(sky,sun,ambient);applyMapLighting(scene,view,'caverns');assert.equal(sky.visible,false);assert.equal(sun.intensity,0);applyMapLighting(scene,view,'island');assert.equal(sky.visible,true);assert.equal(sun.intensity,3.1);assert.equal(scene.background,null);
}));
test('cave rooms support both modes and same-link map switches with late arrivals',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'cave-network-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();
 const until=async(fn:()=>boolean)=>{const at=Date.now();while(!fn()){assert.ok(Date.now()-at<5000,'snapshot arrived');await new Promise(r=>setTimeout(r,20));}};
 async function join(body:object){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.equal(response.status,200);const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);rooms.push(room);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));room.onMessage('combat',()=>{});room.onMessage('mapChanged',()=>{});await until(()=>!!states.get(room.sessionId));return {room,data};}
 try{const {room:owner,data}=await join({mapId:'relay',mode:'defusal',nickname:'Cave creator'});owner.send('changeMap','caverns');await until(()=>states.get(owner.sessionId)?.mapId==='caverns');const {room:guest}=await join({invite:data.invite,nickname:'Cave guest'});assert.equal(guest.roomId,owner.roomId);assert.equal(states.get(guest.sessionId)!.mapId,'caverns');assert.equal(states.get(guest.sessionId)!.bombs.length,2);const {room:dm}=await join({mapId:'caverns',mode:'deathmatch',nickname:'Cave scout'});assert.equal(states.get(dm.sessionId)!.mapId,'caverns');}finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});

test('bird’s-eye cave cutaway hides the roof, opens sightlines and restores the complete gameplay shell',()=>fixture(art=>{
 const root=art.build('caverns'),scene=new THREE.Scene(),view=new THREE.Scene();
 try{
  assert.equal(setCaveCutaway(root,true),true);let roofs=0,sections=0;root.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;if(o.material.userData.caveRoof){roofs++;assert.equal(o.visible,false);}if(o.material.userData.caveSection&&!o.material.userData.caveRoof){sections++;assert.equal(o.material.clippingPlanes?.length,1);}});assert.ok(roofs>=2);assert.ok(sections>=1);assert.equal(setCaveCutaway(root,true),false);
  applyMapLighting(scene,view,'caverns',true);assert.ok((scene.fog as THREE.Fog).near>65,'overview is not swallowed by indoor fog');
  setCaveCutaway(root,false);root.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;assert.equal(o.visible,true);if(o.material.userData.caveSection)assert.equal(o.material.clippingPlanes,null);});
  applyMapLighting(scene,view,'caverns');assert.equal((scene.fog as THREE.Fog).near,18);assert.equal(tourForMap('caverns')[0].eye.y,65);
 }finally{disposeGroup(root);}
}));
