import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Client,type Room} from '@colyseus/sdk';
import {NIGHT_MARKET as map,MARKET_STRINGS,MARKET_SHOPS,MAPS,validMap,intersects,groundAt,footprint,plantSite,move,neutralInput,wallDistance,type Motion,type Snapshot} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildNightMarket} from '../apps/web/components/market-world';
import {applyMapLighting} from '../apps/web/components/map-lighting';
import {tourForMap} from '../apps/web/components/map-tour';
import {surfaceAt} from '../apps/web/components/combat-audio';
import {createGameServer} from '../apps/server/src/http';

function fixture(check:(art:WorldArt)=>void){
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,context=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>context})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};let art:WorldArt|undefined;
 try{art=new WorldArt({capabilities:{getMaxAnisotropy:()=>4}} as unknown as THREE.WebGLRenderer);check(art);}finally{art?.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
}
test('Night Market has protected, connected spawns, clear full-site footprints and grounded racks',()=>{
 assert.equal(MAPS.market,map);assert.ok(validMap('market'));assert.equal(tourForMap('market').length,6);
 const points=[...map.spawns.red,...map.spawns.blue,...map.pickups];for(const p of points){assert.equal(map.solids.some(s=>intersects(p,s)),false,JSON.stringify(p));assert.equal(groundAt(p,map.solids,.36),0);}
 for(const site of map.bombSites!)for(let x=site.x-3;x<=site.x+3;x+=.5)for(let z=-3;z<=3;z+=.5){const p={x,y:0,z};assert.equal(map.solids.some(s=>intersects(p,s)),false);assert.equal(plantSite(p,'market',site.id==='A'?'red':'blue')?.id,site.id);}
 const queue=[[-29,-3]],seen=new Set(['-29,-3']);for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:x+dx,y:0,z:z+dz},key=`${p.x},${p.z}`;if(seen.has(key)||Math.abs(p.x)>33||Math.abs(p.z)>25||map.solids.some(s=>intersects(p,s)))continue;seen.add(key);queue.push([p.x,p.z]);}}
 for(const p of [...points,...map.bombSites!,{x:4,z:0},{x:0,z:-23.5},{x:0,z:23.5}])assert.ok([...seen].some(k=>{const [x,z]=k.split(',').map(Number);return Math.hypot(x-p.x,z-p.z)<1;}),`unreachable ${JSON.stringify(p)}`);
 for(const a of map.spawns.red)for(const b of map.spawns.blue){const length=Math.hypot(b.x-a.x,b.z-a.z);assert.ok(wallDistance({...a,y:1.6},{x:(b.x-a.x)/length,y:0,z:(b.z-a.z)/length},map.solids)<length,'spawn-to-spawn shots are blocked');}
 for(const prop of map.solids.filter(s=>s.kind==='crate'))for(const shop of MARKET_SHOPS)assert.ok(Math.abs(prop.x-shop.x)>=(prop.w+shop.w)/2||Math.abs(prop.z-shop.z)>=(prop.d+shop.d)/2,`${prop.label} is buried inside ${shop.name}`);
 assert.equal(surfaceAt({x:27,y:0,z:0},map.solids),'asphalt');assert.equal(surfaceAt({x:0,y:0,z:9},map.solids),'stone');
});
test('back alleys, cross alleys and both pavilion aisles permit standing movement',()=>{
 for(const z of [-22,22]){let p:Motion={x:-30,y:0,z,vy:0,grounded:true};for(let i=0;i<340;i++)p=move(p,{...neutralInput(),yaw:-Math.PI/2,forward:1},map.solids);assert.ok(p.x>30,`back alley ${z}`);assert.equal(p.y,0);assert.equal(p.crouched,false);}
 for(const x of [-19,19])for(const side of [-1,1]){let p:Motion={x,y:0,z:side*24,vy:0,grounded:true};for(let i=0;i<100;i++)p=move(p,{...neutralInput(),yaw:side>0?0:Math.PI,forward:1},map.solids);assert.ok(Math.abs(p.z)<6,`cross alley ${x},${side}`);}
 for(const x of [-4.3,4.3]){let p:Motion={x,y:0,z:8,vy:0,grounded:true};for(let i=0;i<92;i++)p=move(p,{...neutralInput(),forward:1},map.solids);assert.ok(p.z<-8,'food hall has full head clearance');assert.equal(p.crouched,false);}
 for(const line of MARKET_STRINGS)for(const p of [line.a,line.b])assert.ok(map.solids.some(s=>s.kind==='wall'&&footprint(p,s,.05)&&p.y<=s.y+s.h/2),'every cable end is attached to architecture');
});
test('Night Market renders continuous floors and one face at roof joins, awnings, trim and counter edges',()=>fixture(art=>{
 const root=buildNightMarket(art);root.updateMatrixWorld(true);const ray=new THREE.Raycaster();function single(x:number,y:number,z:number,dx:number,dy:number,dz:number,label:string,far=50){ray.set(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,dy,dz));ray.far=far;const hits=ray.intersectObject(root,true);assert.ok(hits.length,`missing ${label} ${x},${y},${z}`);const nearest=hits[0].distance,owners=new Set(hits.filter(h=>Math.abs(h.distance-nearest)<.0002).map(h=>h.object.uuid));assert.equal(owners.size,1,`${label} has overlapping surfaces`);return nearest;}
 try{
  for(let x=-32.8;x<33;x+=1.6)for(let z=-24.8;z<25;z+=1.6){const p={x,y:0,z};if(map.solids.some(s=>intersects(p,s)))continue;const d=single(x,.08,z,0,-1,0,'floor partition',.12);assert.ok(d>=.063&&d<=.0801,`floor height ${x},${z}: ${d}`);}
  for(const side of [-1,1]){
   single(.03,5,side*3,0,-1,0,'pavilion roof ridge');
   single(12,4.2,side*10.38,0,-1,0,'awning fascia');single(12,4.2,side*11.98,0,-1,0,'awning attachment');
   single(side*2,2,.13,0,-1,0,'serving counter');
  }
  // Check exact duplicate triangles before material batching can hide their ownership.
  const faces=new Set<string>();root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,p=g.attributes.position;for(let i=0;i<p.count;i+=3){const vertices:string[]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k).applyMatrix4(o.matrixWorld)).map(v=>[v.x,v.y,v.z].map(n=>Math.round(n*10000)).join(',')).sort();const key:string=vertices.join('|');assert.equal(faces.has(key),false,`duplicate face ${o.name}`);faces.add(key);}if(g!==o.geometry)g.dispose();});
 }finally{disposeGroup(root);}
}));
test('night scenery batches its props, uses only three shadowless live lights and stays within budget',()=>fixture(art=>{
 const root=art.build('market');try{let draws=0,triangles=0,lights=0;root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}if(o instanceof THREE.PointLight){lights++;assert.equal(o.castShadow,false);}});assert.equal(lights,3);assert.ok(root.userData.marketStats.lanterns>=40);assert.ok(draws<=38,`${draws} draws`);assert.ok(triangles<100000,`${triangles} triangles`);}finally{disposeGroup(root);}
}));
test('switching from Night Market to every daytime map restores sky, lighting, fog and first-person fill',()=>{
 const scene=new THREE.Scene(),view=new THREE.Scene(),sky=new THREE.Group(),sun=new THREE.DirectionalLight(),ambient=new THREE.HemisphereLight(),hand=new THREE.DirectionalLight();sky.name='arenaSky';sun.name='arenaSun';ambient.name='arenaAmbient';hand.name='handFill';scene.add(sky,sun,ambient);view.add(hand);
 for(const day of ['dunes','relay','island'] as const){assert.equal(applyMapLighting(scene,view,'market'),1.1);assert.equal(sky.visible,false);assert.ok(scene.background instanceof THREE.Color);assert.equal(sun.intensity,.85);assert.equal(applyMapLighting(scene,view,day),.95);assert.equal(sky.visible,true);assert.equal(scene.background,null);assert.equal(sun.intensity,3.1);assert.equal(hand.intensity,2.5);assert.equal(view.environmentIntensity,.45);assert.ok((scene.fog as THREE.Fog).far>=155);}
});
test('Night Market supports both modes and late players share a map-switched signed room',{timeout:14000},async()=>{
 const server=await createGameServer({secret:'night-market-network-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();const until=async(fn:()=>boolean)=>{const at=Date.now();while(!fn()){assert.ok(Date.now()-at<4000,'snapshot arrived');await new Promise(r=>setTimeout(r,20));}};
 async function join(body:object){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.equal(response.status,200);const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);rooms.push(room);room.reconnection.enabled=false;room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));room.onMessage('combat',()=>{});room.onMessage('mapChanged',()=>{});await until(()=>!!states.get(room.sessionId));return {room,data};}
 try{
  const {room:owner,data}=await join({mapId:'island',mode:'defusal',nickname:'Market creator'});owner.send('changeMap','market');await until(()=>states.get(owner.sessionId)?.mapId==='market');const {room:guest}=await join({invite:data.invite,nickname:'Market guest'});assert.equal(guest.roomId,owner.roomId);assert.equal(states.get(guest.sessionId)!.mapId,'market');assert.equal(states.get(guest.sessionId)!.bombs.length,2);
  const inspect=await(await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'inspect',invite:data.invite})})).json();assert.equal(inspect.invite,data.invite);assert.equal(inspect.mapId,'market');
  const {room:deathmatch}=await join({mapId:'market',mode:'deathmatch',nickname:'Night tester'});assert.equal(states.get(deathmatch.sessionId)!.mode,'deathmatch');assert.equal(states.get(deathmatch.sessionId)!.mapId,'market');
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
