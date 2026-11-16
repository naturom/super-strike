import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Client,type Room} from '@colyseus/sdk';
import {JUNGLE_ISLAND as island,ISLAND_TREES,ISLAND_PLANTS,ISLAND_ROCKS,ISLAND_LOGS,ISLAND_PATHS,MAPS,validMap,intersects,groundAt,islandRadius,plantSite,move,neutralInput,wallDistance,impactTarget,type Motion,type Snapshot} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {surfaceAt} from '../apps/web/components/combat-audio';
import {tourForMap} from '../apps/web/components/map-tour';
import {islandLog} from '../apps/web/components/island-log';
import {createGameServer} from '../apps/server/src/http';

test('the island is selectable, mid-sized, densely planted, and its spawns, sites and weapons are clear',()=>{
 assert.equal(MAPS.island,island);assert.equal(validMap('island'),true);assert.ok(island.bounds!.maxX-island.bounds!.minX>80);assert.ok(ISLAND_TREES.length>=150);assert.ok(ISLAND_PLANTS.length>=400);assert.ok(ISLAND_ROCKS.length>=20);assert.ok(new Set(ISLAND_TREES.map(t=>t.kind)).size===3);
 for(const p of [...island.spawns.red,...island.spawns.blue,...island.pickups]){assert.equal(island.solids.some(s=>intersects(p,s)),false,JSON.stringify(p));assert.equal(groundAt(p,island.solids,.4),0);}
 for(const site of island.bombSites!)for(let x=site.x-site.w/2;x<=site.x+site.w/2;x+=.5)for(let z=site.z-site.d/2;z<=site.z+site.d/2;z+=.5){const p={x,y:0,z};assert.equal(island.solids.some(s=>intersects(p,s)),false);assert.equal(plantSite(p,'island',site.id==='A'?'red':'blue')?.id,site.id);}
 assert.equal(surfaceAt({x:-36,y:0,z:18},island.solids),'grit');assert.equal(tourForMap('island').length,8);
});
test('all three authored routes stay open and both camps and supplies are connected',()=>{
 for(const path of ISLAND_PATHS)for(let n=1;n<path.length;n++){const a=path[n-1],b=path[n],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*3);for(let i=0;i<=count;i++){const t=i/count,p={x:a[0]+(b[0]-a[0])*t,y:0,z:a[1]+(b[1]-a[1])*t};assert.equal(island.solids.some(s=>intersects(p,s)),false,`blocked route ${JSON.stringify(p)}`);}}
 const b=island.bounds!,queue:[[number,number]]|[number,number][]=[[-36,18]],seen=new Set(['-36,18']);
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:x+dx,y:0,z:z+dz},key=`${p.x},${p.z}`;if(seen.has(key)||p.x<b.minX||p.x>b.maxX||p.z<b.minZ||p.z>b.maxZ||island.solids.some(s=>intersects(p,s)))continue;seen.add(key);queue.push([p.x,p.z]);}}
 for(const p of [...island.spawns.red,...island.spawns.blue,...island.bombSites!,...island.pickups]){assert.ok([...seen].some(key=>{const [x,z]=key.split(',').map(Number);return Math.hypot(x-p.x,z-p.z)<1;}),`unreachable ${JSON.stringify(p)}`);}
});
test('the outer ocean limit contains players without invisible bullet impacts, and trunks and rocks block shots',()=>{
 const shore=island.solids.filter(s=>s.style==='water'||s.kind==='floor');let p:Motion={x:0,y:0,z:0,vy:0,grounded:true};for(let i=0;i<850;i++)p=move(p,{...neutralInput(),forward:1},shore);assert.ok(islandRadius(p.x,p.z)<1.45);assert.ok(p.y< -2.5);assert.equal(shore.some(s=>intersects(p,s)),false);
 const boundary=island.solids.find(s=>s.style==='water'&&s.x>53)!,origin={x:boundary.x-4,y:8,z:boundary.z};assert.equal(wallDistance(origin,{x:1,y:0,z:0},island.solids),150);assert.equal(impactTarget(origin,{x:1,y:0,z:0},island.solids),undefined);
 assert.ok(wallDistance({x:0,y:1.6,z:10},{x:0,y:0,z:-1},island.solids)<12);
});
test('jungle scenery is batched with bounded geometry and leaves do not absorb hit marks',()=>{
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};let art:WorldArt|undefined,root:THREE.Group|undefined;
 try{art=new WorldArt({capabilities:{getMaxAnisotropy:()=>4}} as unknown as THREE.WebGLRenderer);root=art.build('island');root.updateMatrixWorld(true);let draws=0,triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(!Array.isArray(o.material)&&o.material.userData.noRaycast){const hits:THREE.Intersection[]=[];o.raycast(new THREE.Raycaster(new THREE.Vector3(0,100,0),new THREE.Vector3(0,-1,0)),hits);assert.equal(hits.length,0);}}});assert.ok(draws<30,`draw calls: ${draws}`);assert.ok(triangles<300000,`triangles: ${triangles}`);assert.ok(root.children.length<30);assert.equal(root.userData.islandStats.trees,168);
 const ray=new THREE.Raycaster(new THREE.Vector3(-36,5,18),new THREE.Vector3(0,-1,0)),hits=ray.intersectObject(root,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y)<.001,'visible clearing and collision floor agree');
 }finally{if(root)disposeGroup(root);art?.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
});
test('fallen logs have one outward-facing end surface, with bark meeting each cut edge exactly',()=>{
 const bark=new THREE.MeshStandardMaterial(),wood=new THREE.MeshStandardMaterial();
 try{for(const log of ISLAND_LOGS){
  const root=islandLog(log,bark,wood);root.updateMatrixWorld(true);const axis=new THREE.Vector3(log.axis==='x'?1:0,0,log.axis==='z'?1:0),perp=new THREE.Vector3(axis.z,0,axis.x),centre=new THREE.Vector3(log.x,.425,log.z),ray=new THREE.Raycaster();
  try{
   for(const side of [-1,1])for(const offset of [0,.12,.29]){
    const origin=centre.clone().addScaledVector(axis,side*(log.length/2+.2)).addScaledVector(perp,offset);origin.y+=.06;
    ray.set(origin,axis.clone().multiplyScalar(-side));ray.far=.4;const hits=ray.intersectObject(root,true),nearest=hits[0];assert.ok(nearest);assert.ok(Math.abs(nearest.distance-.2)<1e-5);
    assert.equal(new Set(hits.filter(h=>Math.abs(h.distance-nearest.distance)<1e-5).map(h=>h.object.uuid)).size,1,'a cut face must never overlap a cylinder cap');assert.equal(nearest.object.name,'Log cut end');assert.ok(nearest.face!.normal.clone().transformDirection(nearest.object.matrixWorld).dot(ray.ray.direction)<-.999);
   }
   const body=root.getObjectByName('Log bark') as THREE.Mesh,positions=body.geometry.attributes.position,vertices=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(body.matrixWorld));
   for(const cap of root.children.filter(o=>o.name==='Log cut end') as THREE.Mesh[]){const p=cap.geometry.attributes.position;for(let i=1;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(cap.matrixWorld);assert.ok(vertices.some(b=>b.distanceTo(v)<2e-6),'wood edge must meet the bark without a hole or overhang');}}
  }finally{disposeGroup(root);}
 }}finally{bark.dispose();wood.dispose();}
});
test('signed rooms create and switch to Jungle Island while preserving the original invitation',{timeout:12000},async()=>{
 const server=await createGameServer({secret:'island-network-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`;let room:Room|undefined,state:Snapshot|undefined;
 try{const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapId:'island',mode:'defusal',nickname:'Island tester'})}),data=await response.json();assert.equal(response.status,200);assert.equal(data.mapId,'island');room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>state=s);room.onMessage('combat',()=>{});room.onMessage('mapChanged',()=>{});const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<4000,'map state arrived');await new Promise(r=>setTimeout(r,20));}};await until(()=>!!state);assert.equal(state!.mapId,'island');assert.equal(state!.bombs.length,2);const id=room.roomId;room.send('changeMap','dunes');await until(()=>state?.mapId==='dunes');await new Promise(r=>setTimeout(r,1550));room.send('changeMap','island');await until(()=>state?.mapId==='island');assert.equal(room.roomId,id);const inspect=await(await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'inspect',invite:data.invite})})).json();assert.equal(inspect.invite,data.invite);assert.equal(inspect.mapId,'island');
 }finally{if(room?.connection.isOpen)await room.leave();await server.close();}
});
