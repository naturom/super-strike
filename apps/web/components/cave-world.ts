import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CAVERNS,CAVE_PATCHES,CAVE_EDGES,CAVE_ARCHES,CAVE_ROOTS,CAVE_COLUMNS,CAVE_WATER,caveFloor,caveCeiling,type Vec3} from '@sirocco/shared';
import {solidGeometry} from './map-geometry';
import {islandSiteSign} from './island-site-sign';
import type {WorldArt} from './world';

function geometry(triangles:Vec3[][],tint:string,smooth=true){
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],color=new THREE.Color(tint);
 for(const triangle of triangles)for(const p of triangle){positions.push(p.x,p.y,p.z);uvs.push(p.x/4,(p.z+p.y)/4);colors.push(color.r,color.g,color.b);}
 let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 if(smooth){const welded=mergeVertices(g,.00001);g.dispose();g=welded;}g.computeVertexNormals();return g;
}
/** The complete shell is drawn once per surface; shared edges are never covered by duplicate decals. */
export function buildCaverns(art:WorldArt){
 const root=new THREE.Group();root.name='Sunken Caverns';const time={value:0};root.userData.jungleTime=time;
 const rock=art.material('#ffffff',{vertexColors:true,map:art.stone.map,roughness:.91,side:THREE.DoubleSide});
 rock.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 cavePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncavePosition = position;');
  shader.fragmentShader=`varying vec3 cavePosition;
   float caveHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   float caveNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(caveHash(i),caveHash(i+vec3(1,0,0)),f.x),mix(caveHash(i+vec3(0,1,0)),caveHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(caveHash(i+vec3(0,0,1)),caveHash(i+vec3(1,0,1)),f.x),mix(caveHash(i+vec3(0,1,1)),caveHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec3 faceNormal = abs(normalize(cross(dFdx(cavePosition),dFdy(cavePosition))));
   vec3 weights = pow(faceNormal,vec3(4.0));weights /= max(.001,weights.x+weights.y+weights.z);
   vec4 rockTexel = texture2D(map,cavePosition.yz*.32)*weights.x + texture2D(map,cavePosition.xz*.32)*weights.y + texture2D(map,cavePosition.xy*.32)*weights.z;
   diffuseColor *= rockTexel;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float broad = caveNoise(cavePosition * .27);
   float grain = caveNoise(cavePosition * 2.3);
   float strata = sin(cavePosition.y * 9.0 + broad * 5.0 + sin(cavePosition.x * .17 + cavePosition.z * .12)) * .045;
   diffuseColor.rgb *= .76 + broad * .34 + grain * .13 + strata;
   float damp = (1.0 - smoothstep(-.6,.45,cavePosition.y)) * smoothstep(7.0,12.0,cavePosition.z);
   diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb * vec3(.52,.69,.64),damp * .65);
  `);
 };
 rock.customProgramCacheKey=()=> 'cavern-rock-v1';
 rock.userData.caveSection=true;
 const roof=rock.clone();roof.onBeforeCompile=rock.onBeforeCompile;roof.customProgramCacheKey=rock.customProgramCacheKey;roof.userData.caveRoof=true;art.materials.push(roof);
 const floor:Vec3[][]=[],ceiling:Vec3[][]=[],walls:Vec3[][]=[],waterFaces:Vec3[][]=[];
 for(const patch of CAVE_PATCHES){
  const bed=patch.points.map(([x,z],i)=>({x,y:patch.floor[i],z})),roof=patch.points.map(([x,z],i)=>({x,y:patch.ceiling[i],z}));floor.push([bed[0],bed[2],bed[1]]);ceiling.push(roof);
  const wet:Vec3[]=[];
  for(let i=0;i<3;i++){const a=bed[i],b=bed[(i+1)%3],da=CAVE_WATER.level-a.y,db=CAVE_WATER.level-b.y;if(da>0)wet.push({...a,y:CAVE_WATER.level});if((da>0)!==(db>0)){const t=da/(da-db);wet.push({x:a.x+(b.x-a.x)*t,y:CAVE_WATER.level,z:a.z+(b.z-a.z)*t});}}
  for(let i=1;i<wet.length-1;i++)waterFaces.push([wet[0],wet[i+1],wet[i]]);
 }
 for(const {a,b} of CAVE_EDGES){const a0={x:a[0],y:caveFloor(...a),z:a[1]},b0={x:b[0],y:caveFloor(...b),z:b[1]},a1={...a0,y:caveCeiling(...a)},b1={...b0,y:caveCeiling(...b)};walls.push([a0,b0,a1],[b0,b1,a1]);}
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,name:string,shadow=true){const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=shadow;o.receiveShadow=true;root.add(o);return o;}
 for(const patch of CAVE_ROOTS)floor.push(patch.points.map(([x,z],i)=>({x,y:patch.floor[i],z})));
 for(const arch of CAVE_ARCHES)ceiling.push(arch.points.map(([x,z],i)=>({x,y:arch.floor[i],z})));
 mesh(geometry(floor,'#9c9583'),rock,'Cave floor',false);mesh(geometry(ceiling,'#8b8779'),roof,'Cave roof');mesh(geometry(walls,'#a19c8b'),rock,'Continuous cave walls');
 for(const column of CAVE_COLUMNS){const g=solidGeometry(column),c=g.attributes.position,colors:number[]=[];const tint=new THREE.Color('#aaa18b');for(let i=0;i<c.count;i++)colors.push(tint.r,tint.g,tint.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));mesh(g,rock,'Limestone column');}
 const water=art.material('#17686c',{roughness:.19,metalness:.28,transparent:true,opacity:.66,depthWrite:false,side:THREE.DoubleSide});water.userData.noRaycast=true;
 water.onBeforeCompile=shader=>{shader.uniforms.caveTime=time;shader.vertexShader='varying vec3 caveWaterPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncaveWaterPosition = position;');shader.fragmentShader='varying vec3 caveWaterPosition;\nuniform float caveTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  normal.x += sin(caveWaterPosition.x * 2.2 + caveWaterPosition.z * .9 + caveTime * .8) * .028;
  normal.z += cos(caveWaterPosition.z * 1.7 - caveTime * .7) * .028;normal = normalize(normal);
 `);};water.customProgramCacheKey=()=> 'cavern-water-v1';mesh(geometry(waterFaces,'#ffffff'),water,'Flooded passage water',false);
 const mineral=art.material('#9b9985',{map:art.stone.map,roughness:.9}),warm=art.material('#fff1bc',{emissive:'#ffc16c',emissiveIntensity:2}),cool=art.material('#b3e4df',{emissive:'#63c5ca',emissiveIntensity:1.5});
 mineral.userData.caveRoof=true;
 // Hanging formations are rooted in the ceiling and kept well above every walking route.
 for(let i=0;i<CAVE_EDGES.length;i+=3){const {a,b}=CAVE_EDGES[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,top=caveCeiling(x,z),bottom=caveFloor(x,z),length=.55+(Math.sin(i*14.1)*.5+.5)*1.25;if(top-bottom<4.8)continue;const o=mesh(new THREE.ConeGeometry(.22+(i%4)*.075,length,7),mineral,'Ceiling stalactite');o.rotation.z=Math.PI;o.position.set(x,top-length/2+.015,z);}
 // Expedition lamps guide the route. Six shadowless lights also illuminate moving players.
 const lamps=[[-38,-4,1],[-22,-15,0],[8,-17,1],[38,4,0],[-20,17,1],[20,16,0],[0,-6,1],[0,10,0]];
 for(const [i,[x,z,tone]] of lamps.entries()){
  const y=caveFloor(x,z),glow=tone?warm:cool;
  art.cylinder(root,.18,.23,.10,art.metal,x,y+.05,z);art.cylinder(root,.075,.075,.42,glow,x,y+.31,z);art.cylinder(root,.15,.15,.06,art.metal,x,y+.55,z);
  if(i<6){const light=new THREE.PointLight(tone?'#ffce91':'#96d9df',85,23,2);light.position.set(x,y+1.5,z);root.add(light);}
 }
 // Small mineral seams are embedded in walls rather than floating in walking space.
 const crystal=art.material('#4d918c',{emissive:'#276b6b',emissiveIntensity:.45,metalness:.15,roughness:.45});
 for(let i=1;i<CAVE_EDGES.length;i+=11){const {a,b}=CAVE_EDGES[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,base=caveFloor(x,z);for(let j=0;j<3;j++){const c=mesh(new THREE.ConeGeometry(.12,.45+j*.13,5),crystal,'Mineral vein',false);c.position.set(x+(j-1)*.13,base+.8+j*.16,z);c.rotation.z=(j-1)*.3;}}
 const marker=art.material('#edc889',{emissive:'#80613a',emissiveIntensity:.3,roughness:.9});
 for(const site of CAVERNS.bombSites!){const ring=mesh(new THREE.RingGeometry(2.65,2.72,64),marker,`Site ${site.id}`,false);ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.012,site.z);
  const sign=islandSiteSign(art,site);sign.position.set(site.x,0,site.z-4.2);sign.rotation.y=site.id==='A'?Math.PI/4:-Math.PI/4;root.add(sign);
 }
 root.userData.caveStats={patches:CAVE_PATCHES.length,edges:CAVE_EDGES.length,liveLights:6};return root;
}
