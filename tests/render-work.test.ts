import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MAPS,type MapId} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {Minimap} from '../apps/web/components/Minimap';
import {minimapTerrain} from '../apps/web/components/minimap-terrain';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {animateAvatarMotion} from '../apps/web/components/avatar-motion';

test('minimap terrain retains every map shape in one cached image while live markers still move',()=>{
 for(const mapId of Object.keys(MAPS) as MapId[]){const map=MAPS[mapId],uri=minimapTerrain(mapId),svg=decodeURIComponent(uri.slice('data:image/svg+xml,'.length)),shapes=map.solids.filter(s=>s.kind==='floor'&&s.label!=='Foundation'||s.style!=='water'&&(s.kind==='wall'||s.kind==='crate'));assert.equal((svg.match(/<(?:polygon|rect) /g)??[]).length,shapes.length);assert.equal(minimapTerrain(mapId),uri);const s=new Simulation(mapId),p=s.add('p','P');const html=renderToStaticMarkup(createElement(Minimap,{snapshot:s.snapshot(),me:p,room:null}));assert.equal((html.match(/<image /g)??[]).length,1);assert.ok(!html.includes('<polygon '),'thousands of cave triangles must not be live DOM nodes');p.x+=1.25;p.z+=.75;const moved=renderToStaticMarkup(createElement(Minimap,{snapshot:s.snapshot(),me:p,room:null}));assert.notEqual(moved,html);assert.ok(moved.includes(`translate(${p.x} ${p.z})`));}
});

test('idle character arms reuse their GPU buffers, and moving the grip or aim still updates the real mesh',()=>{
 const before=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{for(const avatar of ['ironman','ultraman','wonder-woman'] as const){const model=buildAvatar(art,avatar),held=equipAvatarModel(art,model,'rifle',avatar),idle={reload:0,plant:0,throwProgress:0,slash:1};animateAvatarMotion(model,'rifle',idle,1/60,true);const arms=['leftArm','rightArm'].map(name=>held.getObjectByName(name)!.userData.ironArm.skin as THREE.Mesh),versions=arms.map(s=>(s.geometry.attributes.position as THREE.BufferAttribute).version);for(let i=0;i<30;i++)animateAvatarMotion(model,'rifle',idle,1/60,true);arms.forEach((s,i)=>assert.equal((s.geometry.attributes.position as THREE.BufferAttribute).version,versions[i],`${avatar}: idle arm recalculates and uploads every frame`));animateAvatarMotion(model,'rifle',{...idle,reload:.45},1/60,true,.4);arms.forEach((s,i)=>assert.ok((s.geometry.attributes.position as THREE.BufferAttribute).version>versions[i],`${avatar}: active arms must stay animated`));disposeGroup(model);}}finally{art.destroy();globalThis.document=before;THREE.TextureLoader.prototype.load=load;}
});
