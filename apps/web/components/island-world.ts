import * as THREE from 'three';
import {JUNGLE_ISLAND,ISLAND_TREES,ISLAND_PLANTS,ISLAND_ROCKS,ISLAND_LOGS,ISLAND_COAST,ISLAND_SIZE,islandCoast,islandPathDistance} from '@sirocco/shared';
import type {WorldArt} from './world';
import {islandLog} from './island-log';

/** Every solid trunk, boulder and log uses the same coordinates as server collision. */
export function buildIsland(art:WorldArt){
 const root=new THREE.Group();root.name='Jungle Island';const time={value:0};root.userData.jungleTime=time;
 let seed=70513;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=256;const context=grainCanvas.getContext('2d')!,pixels=context.createImageData(256,256);for(let i=0;i<256*256;i++){const shade=180+random()*70;pixels.data[i*4]=shade;pixels.data[i*4+1]=shade;pixels.data[i*4+2]=shade;pixels.data[i*4+3]=255;}context.putImageData(pixels,0,0);const grain=new THREE.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.colorSpace=THREE.SRGBColorSpace;art.textures.push(grain);
 const earth=art.material('#ffffff',{vertexColors:true,map:grain,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.16,.16),roughness:1});
 const rock=art.material('#ffffff',{vertexColors:true,map:grain,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.9,.9),roughness:.98});
 const bark=art.material('#665845',{map:art.timber.map,normalMap:art.timber.normalMap,normalScale:new THREE.Vector2(.55,.55),roughness:1});
 const cutWood=art.material('#a9986b',{roughness:.98}),leaf=art.material('#ffffff',{vertexColors:true,side:THREE.DoubleSide,roughness:.82}),underleaf=art.material('#ffffff',{vertexColors:true,side:THREE.DoubleSide,roughness:.94});
 for(const material of [leaf,underleaf]){
  material.userData.noRaycast=true;
  material.onBeforeCompile=shader=>{shader.uniforms.jungleTime=time;shader.vertexShader='uniform float jungleTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat sway = smoothstep(0.2, 8.0, position.y); transformed.x += sin(jungleTime * 1.05 + position.z * .35 + position.x * .13) * .11 * sway; transformed.z += cos(jungleTime * .8 + position.x * .27) * .07 * sway;');};
  material.customProgramCacheKey=()=> 'jungle-foliage-v1';
 }
 const surface=new THREE.BufferGeometry(),positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[],segments=64,rings=24;
 const sandColor=new THREE.Color('#cbb990'),soilColor=new THREE.Color('#4e5134'),trailColor=new THREE.Color('#8b8060');
 function groundVertex(x:number,z:number,r:number){positions.push(x,0,z);uv.push(x/9,z/9);const beach=THREE.MathUtils.smoothstep(r,.76,.94),trail=1-THREE.MathUtils.smoothstep(islandPathDistance({x,z}),1.5,3.4),grain=.92+.08*Math.sin(x*.23)*Math.cos(z*.19);const color=soilColor.clone().lerp(trailColor,trail*.75).lerp(sandColor,beach).multiplyScalar(grain);colors.push(color.r,color.g,color.b);}
 groundVertex(0,0,0);
 for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++){const angle=i*Math.PI*2/segments,r=ring/rings*islandCoast(angle);groundVertex(Math.cos(angle)*ISLAND_SIZE.x*r,Math.sin(angle)*ISLAND_SIZE.z*r,ring/rings);}
 for(let i=0;i<segments;i++)indices.push(0,1+(i+1)%segments,1+i);
 for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){const a=1+(ring-1)*segments+i,b=1+(ring-1)*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}
 surface.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));surface.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));surface.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));surface.setIndex(indices);surface.computeVertexNormals();const land=new THREE.Mesh(surface,earth);land.receiveShadow=true;root.add(land);
 // The ocean is a single opaque draw, with small waves and a shallow-water foam band.
 const ocean=art.material('#368c91',{roughness:.24,metalness:.24});
 ocean.userData.noRaycast=true;
 ocean.onBeforeCompile=shader=>{shader.uniforms.jungleTime=time;shader.vertexShader='varying vec2 oceanPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\noceanPosition = position.xz;');shader.fragmentShader='varying vec2 oceanPosition;\nuniform float jungleTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float angle = atan(oceanPosition.y / 44.0, oceanPosition.x / 54.0);
 float coast = 1.0 + .035 * sin(angle * 3.0 + .6) + .028 * sin(angle * 7.0 - 1.1);
 float radius = length(oceanPosition / vec2(54.0,44.0)) / coast;
 float wave = sin(dot(oceanPosition,vec2(1.8,.7)) + jungleTime * 1.4) * .5 + sin(dot(oceanPosition,vec2(-.6,1.3)) - jungleTime * 1.1) * .35 + sin(dot(oceanPosition,vec2(.3,.5)) + jungleTime * .7) * .15;
 float shallow = 1.0 - smoothstep(1.0,1.30,radius);
 float foam = (1.0 - smoothstep(.012,.065,abs(radius - 1.022 - sin(jungleTime + angle * 9.0)*.006))) * (.55 + .45 * wave);
 diffuseColor.rgb = mix(vec3(.035,.18,.24),vec3(.12,.49,.44),shallow) + wave * .006 + foam * vec3(.45,.52,.43);
 `);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nfloat swell = sin(dot(oceanPosition,vec2(.68,.83)) + jungleTime * .9) * .007; normal.x += swell; normal.z += swell * .6; normal = normalize(normal);');};
 ocean.customProgramCacheKey=()=> 'jungle-ocean-v1';const sea=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),ocean);sea.rotation.x=-Math.PI/2;sea.position.y=-.24;root.add(sea);
 function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=root,shadow=true){const object=new THREE.Mesh(geometry,material);object.castShadow=shadow;object.receiveShadow=true;parent.add(object);return object;}
 function branch(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r0:number,r1:number,material=bark){const geometry=new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),8);geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));geometry.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return mesh(geometry,material,parent);}
 function blade(length:number,width:number,bend:number,color:THREE.Color,material:THREE.Material,parent:THREE.Object3D,angle:number,tilt:number){
  const geometry=new THREE.BufferGeometry(),p:number[]=[],u:number[]=[],c:number[]=[],index:number[]=[],rows=length>3?6:3;
  for(let i=0;i<=rows;i++){const t=i/rows,w=Math.sin(Math.PI*t)**.8*width;for(let side=-1;side<=1;side++){p.push(side*w*.5,Math.sin(Math.PI*t)*length*.15-bend*t*t-(side?width*.045:0),length*t);u.push((side+1)/2,t);const shade=color.clone().multiplyScalar(side===0?1.06:.95);c.push(shade.r,shade.g,shade.b);}}
  for(let i=0;i<rows;i++)for(let side=0;side<2;side++){const a=i*3+side,b=a+3;index.push(a,b,a+1,b,b+1,a+1);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geometry.setIndex(index);geometry.computeVertexNormals();const object=mesh(geometry,material,parent,material===leaf);object.rotation.set(tilt,angle,0);return object;
 }
 const tones=['#3d6537','#52773b','#66873e','#2d5635','#7d994b'].map(color=>new THREE.Color(color));
 for(const tree of ISLAND_TREES){
  const group=new THREE.Group();group.position.set(tree.x,0,tree.z);root.add(group);const height=tree.height;
  branch(group,new THREE.Vector3(),new THREE.Vector3(0,height*(tree.kind==='palm'?1:tree.kind==='sapling'?.85:.96),0),tree.radius,tree.radius*.6);
  if(tree.kind==='canopy')for(let i=0;i<4;i++){const angle=tree.angle+i*Math.PI/2;branch(group,new THREE.Vector3(Math.cos(angle)*tree.radius*2.3,.02,Math.sin(angle)*tree.radius*2.3),new THREE.Vector3(0,1.25,0),tree.radius*.35,tree.radius*.22);}
  const crowns=tree.kind==='palm'?1:tree.kind==='sapling'?3:7;
  for(let k=0;k<crowns;k++){
   const angle=tree.angle+k*2.4,reach=tree.kind==='palm'||k===crowns-1?0:tree.kind==='sapling'?1.05:2.1,crown=new THREE.Group();crown.position.set(Math.cos(angle)*reach,height*(tree.kind==='palm'?1:tree.kind==='sapling'?.76+k*.045:.72+k*.04),Math.sin(angle)*reach);group.add(crown);
   if(reach)branch(group,new THREE.Vector3(0,height*.65,0),crown.position,tree.radius*.42,.055);
   const count=tree.kind==='palm'?12:tree.kind==='sapling'?10:16;
   for(let i=0;i<count;i++){const length=tree.kind==='palm'?3.8+random()*1.2:tree.kind==='sapling'?1.1+random()*.7:1+random()*.9;blade(length,tree.kind==='palm'?.7:.50+random()*.35,tree.kind==='palm'?1.7:random()*.5,tones[Math.floor(random()*tones.length)],leaf,crown,i*Math.PI*2/count+angle,(random()-.5)*.45);}
  }
 }
 for(const plant of ISLAND_PLANTS){const group=new THREE.Group();group.position.set(plant.x,0,plant.z);root.add(group);const count=plant.kind==='bush'?28:plant.kind==='fern'?9:7;
  for(let i=0;i<count;i++){const color=tones[Math.floor(random()*tones.length)],length=plant.size*(plant.kind==='grass'?.8:plant.kind==='bush'?.35+random()*.4:1.1+random()*.5),object=blade(length,plant.kind==='grass'?.08:plant.kind==='fern'?.25:.42,plant.kind==='bush'?.05:.3,color,underleaf,group,plant.angle+i*Math.PI*2/count,plant.kind==='bush'?-.8-random()*.4:plant.kind==='grass'?-1.1:-.3);object.position.y=plant.kind==='bush'?.15+random()*plant.size*.75:0;if(plant.kind==='bush'){object.position.x=Math.cos(plant.angle+i)*plant.size*.3;object.position.z=Math.sin(plant.angle+i)*plant.size*.3;}}
 }
 for(const solid of ISLAND_ROCKS){
  const geometry=new THREE.BufferGeometry(),points:number[]=[],uvs:number[]=[],tints:number[]=[],indices:number[]=[],outline=solid.polygon!,count=outline.length;
  const stoneColor=new THREE.Color('#737b70'),mossColor=new THREE.Color('#596b47'),levels=[[0,1],[.20,1.02],[.76,.93],[1,.72]];
  for(let ring=0;ring<levels.length;ring++)for(let i=0;i<count;i++){const [height,scale]=levels[ring],p=outline[i];points.push(solid.x+(p[0]-solid.x)*scale,solid.h*height,solid.z+(p[1]-solid.z)*scale);uvs.push(p[0]/3,p[1]/3+height);const color=stoneColor.clone().lerp(mossColor,ring===3?.7:ring===2?.3:0).multiplyScalar(.88+random()*.24);tints.push(color.r,color.g,color.b);}
  for(let ring=0;ring<3;ring++)for(let i=0;i<count;i++){const a=ring*count+i,b=ring*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,c,b,b,c,d);}
  points.push(solid.x,solid.h,solid.z);uvs.push(solid.x/3,solid.z/3);tints.push(mossColor.r,mossColor.g,mossColor.b);const centre=points.length/3-1;
  for(let i=0;i<count;i++)indices.push(centre,3*count+(i+1)%count,3*count+i);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(geometry,rock);
 }
 for(const log of ISLAND_LOGS)root.add(islandLog(log,bark,cutWood));
 // Small shore stones and driftwood break up the beach without blocking traversal.
 for(let i=0;i<90;i++){const a=random()*Math.PI*2,r=.86+random()*.11,x=Math.cos(a)*ISLAND_SIZE.x*islandCoast(a)*r,z=Math.sin(a)*ISLAND_SIZE.z*islandCoast(a)*r;if(islandPathDistance({x,z})<2||JUNGLE_ISLAND.pickups.some(p=>Math.hypot(p.x-x,p.z-z)<2))continue;const stone=mesh(new THREE.IcosahedronGeometry(.1+random()*.22,0),rock,root,false);stone.position.set(x,.07,z);stone.scale.set(1.3,.6,1);stone.rotation.set(random(),random()*Math.PI,random());}
 for(const site of JUNGLE_ISLAND.bombSites!){const ring=mesh(new THREE.RingGeometry(site.marker.size*.46,site.marker.size*.48,48),art.material('#d6b77d',{roughness:1}),root,false);ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.012,site.z);
  art.sign(root,site.id,site.x+(site.id==='A'?4:-4),1.3,site.z+(site.id==='A'?4:-4),site.id==='A'?-Math.PI/2:Math.PI/2,'#435638',1.2);
  // A sign is mounted to a wooden post rather than floating in the clearing.
  branch(root,new THREE.Vector3(site.x+(site.id==='A'?4:-4),0,site.z+(site.id==='A'?4:-4)),new THREE.Vector3(site.x+(site.id==='A'?4:-4),1.65,site.z+(site.id==='A'?4:-4)),.055,.055);
 }
 root.userData.islandStats={trees:ISLAND_TREES.length,plants:ISLAND_PLANTS.length,rocks:ISLAND_ROCKS.length};return root;
}
