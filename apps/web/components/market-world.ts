import * as THREE from 'three';
import {NIGHT_MARKET,MARKET_SHOPS,MARKET_STRINGS,type Solid} from '@sirocco/shared';
import {visibleSolidGeometry} from './map-geometry';
import type {WorldArt} from './world';

/** Static light pools are part of the material, not stacked transparent floor decals. */
function marketLight(material:THREE.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 marketPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmarketPosition = position;');
  shader.fragmentShader='varying vec3 marketPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 lightWash = vec3(0.0);
   ${[-26,-12,12,26].flatMap((x,i)=>[-8.5,8.5].map(z=>`lightWash += vec3(${i%2===0?'1.0,.38,.11':'.12,.48,.65'}) * .16 / (1.0 + dot(marketPosition - vec3(${x.toFixed(1)},1.8,${z.toFixed(1)}),marketPosition - vec3(${x.toFixed(1)},1.8,${z.toFixed(1)})) * .11);`)).join('\n')}
   totalEmissiveRadiance += lightWash;
  `);
 };
 material.customProgramCacheKey=()=> 'market-static-light-v1';return material;
}
export function buildNightMarket(art:WorldArt){
 const root=new THREE.Group();root.name='Night Market';
 const plaster=MARKET_SHOPS.map(shop=>marketLight(art.material(shop.color,{map:art.plaster.map,normalMap:art.plaster.normalMap,normalScale:new THREE.Vector2(.2,.2),roughness:.86})));
 const rear=marketLight(art.material('#5b646d',{map:art.plaster.map,normalMap:art.plaster.normalMap,normalScale:new THREE.Vector2(.18,.18)}));
 const paving=marketLight(art.material('#67777a',{map:art.paving.map,normalMap:art.paving.normalMap,normalScale:new THREE.Vector2(.23,.23),roughness:.36,metalness:.12}));
 const asphalt=marketLight(art.material('#465258',{map:art.asphalt.map,normalMap:art.asphalt.normalMap,normalScale:new THREE.Vector2(.15,.15),roughness:.46}));
 const wood=marketLight(art.material('#66503b',{map:art.timber.map,normalMap:art.timber.normalMap,normalScale:new THREE.Vector2(.22,.22),roughness:.8}));
 const roof=marketLight(art.material('#384b48',{map:art.timber.map,normalMap:art.timber.normalMap,normalScale:new THREE.Vector2(.15,.15),roughness:.72}));
 const steel=art.material('#60737a',{metalness:.7,roughness:.4}),black=art.material('#18272e',{roughness:.7}),glass=art.material('#2c4858',{emissive:'#173044',emissiveIntensity:.35,metalness:.45,roughness:.18}),trim=marketLight(art.material('#aa9780',{roughness:.8}));
 const canopyCanvas=document.createElement('canvas');canopyCanvas.width=256;canopyCanvas.height=64;const cc=canopyCanvas.getContext('2d')!;cc.fillStyle='#c49d79';cc.fillRect(0,0,256,64);cc.fillStyle='#725b4c';for(let x=0;x<256;x+=64)cc.fillRect(x,0,32,64);const clothTexture=new THREE.CanvasTexture(canopyCanvas);clothTexture.wrapS=clothTexture.wrapT=THREE.RepeatWrapping;clothTexture.colorSpace=THREE.SRGBColorSpace;art.textures.push(clothTexture);
 const cloth=marketLight(art.material('#ffffff',{map:clothTexture,roughness:1}));
 const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,shadow=true)=>{const o=new THREE.Mesh(geometry,material);o.castShadow=shadow;o.receiveShadow=true;root.add(o);return o;};
 const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>art.box(root,w,h,d,m,x,y,z);
 function finish(b:Solid){const shopIndex=MARKET_SHOPS.findIndex(s=>b.label===`${s.name} shophouse`);return shopIndex>=0?plaster[shopIndex]:b.kind==='floor'?b.style==='road'?asphalt:paving:b.label?.includes('fabric awning')?cloth:b.label?.includes('roof')||b.label?.includes('ridge')?roof:b.style==='wood'?wood:b.style==='metal'?steel:b.style==='stone'?trim:rear;}
 // The union removes buried and coincident faces, including roof/wall and street seams.
 for(const b of NIGHT_MARKET.solids){const geometry=visibleSolidGeometry(b,NIGHT_MARKET.solids);if(!geometry.attributes.position.count){geometry.dispose();continue;}const o=mesh(geometry,finish(b),b.kind!=='floor');o.name=b.label??'';}
 // A single sign atlas keeps all illuminated lettering to one material and draw.
 const labels=[...MARKET_SHOPS.map(s=>s.name),'NIGHT MARKET','A / EAST GATE','B / WEST GATE','BACK ALLEYS'],atlasCanvas=document.createElement('canvas');atlasCanvas.width=2048;atlasCanvas.height=512;const c=atlasCanvas.getContext('2d')!;
 labels.forEach((label,i)=>{const x=i%4*512,y=Math.floor(i/4)*128,color=['#ffd6a0','#81e1ce','#f5a8c9','#9bcef4'][i%4];c.fillStyle='#132027';c.fillRect(x,y,512,128);c.strokeStyle=color;c.lineWidth=4;c.strokeRect(x+10,y+9,492,110);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='bold 39px sans-serif';c.fillText(label,x+256,y+65);});
 const atlas=new THREE.CanvasTexture(atlasCanvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;art.textures.push(atlas);const lettering=art.material('#ffffff',{map:atlas,emissiveMap:atlas,emissive:'#ffffff',emissiveIntensity:.95,roughness:.7});
 function sign(index:number,x:number,y:number,z:number,rotation=0,width=6.5,height=.85){const geometry=new THREE.PlaneGeometry(width,height),uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(index%4+uv.getX(i))/4,1-(Math.floor(index/4)+1-uv.getY(i))/4);const o=mesh(geometry,lettering,false);o.name=`Sign ${labels[index]}`;o.position.set(x,y,z);o.rotation.y=rotation;}
 const shutter=marketLight(art.material('#526067',{metalness:.55,roughness:.61}));
 for(const [index,shop] of MARKET_SHOPS.entries()){
  const front=shop.side*12,face=front-shop.side*.07;
  sign(index,shop.x,4.65,face,shop.side<0?0:Math.PI,7.4,.85);
  // Closed shutters and display windows are mounted to the actual shop facade.
  box(2.8,2.6,.09,shutter,shop.x-2.1,1.3,face);
  for(let i=0;i<12;i++)box(2.65,.035,.025,steel,shop.x-2.1,.12+i*.21,face-shop.side*.06);
  box(3.25,2.1,.08,glass,shop.x+1.65,1.42,face);
  for(const dx of [-1.68,1.68])box(.11,2.3,.13,trim,shop.x+1.65+dx,1.42,face);
  for(const y of [.215,2.625])box(3.47,.11,.13,trim,shop.x+1.65,y,face);
  // Upper windows vary by shop rather than covering every wall with a grid.
  for(const dx of index%3===0?[-2,2]:[.8]){
   box(1.2,1.45,.07,glass,shop.x+dx,6.12,face);
   box(1.35,.10,.18,trim,shop.x+dx,5.345,face);
  }
  // Awning fascia meets its sloping canopy at the front edge; side brackets are attached.
  box(8.8,.14,.08,cloth,shop.x,3.08,shop.side*10.38);
  for(const dx of [-4.2,4.2])box(.06,.06,1.65,steel,shop.x+dx,3.03,shop.side*11.18);
  // A downpipe is fixed to the wall and ends at ground level.
  art.cylinder(root,.045,.045,shop.h-.15,steel,shop.x+4.65,(shop.h-.15)/2,face-shop.side*.06);
 }
 for(const side of [-1,1]){box(8,.10,.16,wood,0,3.4,side*6.2);sign(8,0,3.05,side*6.31,side<0?Math.PI:0,7.5,.62);}
 for(const side of [-1,1]){sign(side<0?10:9,side*33.92,4.1,0,side<0?Math.PI/2:-Math.PI/2,6.5,.85);sign(11,0,3.5,side*26.17,side<0?0:Math.PI,5.4,.8);}
 // Lantern cables terminate at real facade faces. Static tension curves never flicker.
 const cable=art.material('#1a2429',{roughness:.92}),paper=art.material('#b33328',{emissive:'#ff5624',emissiveIntensity:1.25,roughness:.85}),gold=art.material('#a36b2e',{metalness:.45,roughness:.5});
 let lanternCount=0;
 for(const string of MARKET_STRINGS){
  const a=new THREE.Vector3(string.a.x,string.a.y,string.a.z),b=new THREE.Vector3(string.b.x,string.b.y,string.b.z),curvePoints:THREE.Vector3[]=[];
  for(let i=0;i<=24;i++){const t=i/24,p=a.clone().lerp(b,t);p.y-=Math.sin(t*Math.PI)*.42;curvePoints.push(p);}
  const curve=new THREE.CatmullRomCurve3(curvePoints);mesh(new THREE.TubeGeometry(curve,32,.018,4,false),cable,false);
  const count=Math.floor(a.distanceTo(b)/3.7);for(let i=1;i<count;i++){
   const p=curve.getPoint(i/count);art.cylinder(root,.014,.014,.16,cable,p.x,p.y-.08,p.z);
   const lantern=mesh(new THREE.SphereGeometry(.24,12,8),paper,false);lantern.position.set(p.x,p.y-.42,p.z);lantern.scale.y=1.25;
   for(const y of [-.13,-.71])art.cylinder(root,.11,.11,.04,gold,p.x,p.y+y,p.z);
   art.cylinder(root,.018,.018,.15,gold,p.x,p.y-.805,p.z);lanternCount++;
  }
 }
 // Food preparation details sit on the counters; no loose props occupy the walking aisles.
 const leaf=art.material('#487155',{roughness:1}),fruit=art.material('#c58438',{roughness:.7});
 for(const side of [-1,1])for(const z of [-2,0,2]){
  const tray=box(.8,.055,1.1,steel,side*2,1.0775,z);
  for(let i=0;i<5;i++){const food=mesh(new THREE.SphereGeometry(.10,8,6),z===0?fruit:leaf,false);food.position.set(side*2+(i%2-.5)*.26,1.18,z+Math.floor(i/2)*.24-.24);}
  tray.name='Food tray';
 }
 box(2.9,.25,7.1,steel,0,2.725,0);art.cylinder(root,.18,.18,.5,steel,0,3.1,0);
 for(const b of NIGHT_MARKET.solids.filter(s=>s.kind==='crate'&&!s.label?.startsWith('Dining'))){
  for(const y of [b.y-b.h/2+.09,b.y+b.h/2-.09])box(b.w+.055,.08,b.d+.055,wood,b.x,y,b.z);
  for(const x of [-b.w/2+.12,b.w/2-.12])box(.07,b.h-.28,b.d+.14,wood,b.x+x,b.y,b.z);
  if(b.label==='Street planter')for(let i=0;i<9;i++){const plant=mesh(new THREE.ConeGeometry(.2,.8+(i%3)*.16,5),leaf,false);plant.position.set(b.x+(i%3-1)*.5,b.y+b.h/2+.32,b.z+(Math.floor(i/3)-1)*.24);}
 }
 const lamp=art.material('#ffe7b7',{emissive:'#ffd490',emissiveIntensity:1.3,roughness:.4});
 box(.9,.08,1.7,steel,-3.8,3.31,0);box(.75,.025,1.5,lamp,-3.8,3.255,0);
 for(const side of [-1,1]){
  box(1.2,.08,.10,steel,side*33.4,4.8,0);box(.15,.3,.15,steel,side*32.8,4.65,0);
  const shade=mesh(new THREE.ConeGeometry(.32,.16,12,1,true),steel);shade.position.set(side*32.8,4.5,0);
  const bulb=mesh(new THREE.SphereGeometry(.11,8,6),lamp,false);bulb.position.set(side*32.8,4.42,0);
 }
 // Three shadowless lights illuminate moving characters. Most scenery lighting is static.
 for(const [x,z,color,power] of [[-32.8,0,'#ffc184',105],[32.8,0,'#85cbdc',105],[-3.8,0,'#ffbf78',45]] as const){const light=new THREE.PointLight(color,power,19,2);light.position.set(x,Math.abs(x)>30?4.35:3.17,z);root.add(light);}
 const markerMaterial=art.material('#deaa62',{emissive:'#9f672e',emissiveIntensity:.35,roughness:.8});
 for(const site of NIGHT_MARKET.bombSites!){const ring=mesh(new THREE.RingGeometry(2.7,2.77,64),markerMaterial,false);ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.014,site.z);}
 root.userData.marketStats={lanterns:lanternCount,liveLights:3};return root;
}
