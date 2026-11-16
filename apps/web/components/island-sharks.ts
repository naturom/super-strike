import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {ISLAND_SIZE,islandCoast} from '@sirocco/shared';
import type {WorldArt} from './world';

/** Ambient reef shark. It is scenery, never a combat target or a source of damage. */
export class IslandSharks {
 readonly root=new THREE.Group();private tail=new THREE.Group();private started=-Infinity;private next=Infinity;private entered=false;private angle=0;private passes=0;
 constructor(art:WorldArt){
  this.root.name='Passing reef shark';this.root.visible=false;
  const material=art.material('#ffffff',{vertexColors:true,roughness:.58,metalness:.08}),bodyParts:THREE.BufferGeometry[]=[];
  const tint=(g:THREE.BufferGeometry,color:string)=>{const c=new THREE.Color(color),p=g.attributes.position,a=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const belly=p.getY(i)<-.08?new THREE.Color('#bdc8c1'):c;a.set([belly.r,belly.g,belly.b],i*3);}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g.index?g.toNonIndexed():g;};
  const body=new THREE.SphereGeometry(1,20,12);body.scale(.28,.24,1.14);body.translate(0,0,-.12);bodyParts.push(tint(body,'#657f83'));
  const snout=new THREE.SphereGeometry(1,12,8);snout.scale(.22,.13,.44);snout.translate(0,-.035,-1.04);bodyParts.push(tint(snout,'#657f83'));
  const fin=(points:number[][],color='#5e747a')=>{
   const g=new THREE.BufferGeometry(),p:number[]=[],vertices=points.map(p=>new THREE.Vector3(...p as [number,number,number])),center=vertices.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(.25);
   for(const ids of [[0,1,2],[0,3,1],[1,3,2],[2,3,0]]){const [a,b,c]=ids.map(i=>vertices[i]),normal=b.clone().sub(a).cross(c.clone().sub(a)),out=a.clone().add(b).add(c).multiplyScalar(1/3).sub(center);if(normal.dot(out)<0)[ids[1],ids[2]]=[ids[2],ids[1]];for(const i of ids)p.push(...points[i]);}
   g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.length/3*2),2));g.computeVertexNormals();return tint(g,color);
  };
  bodyParts.push(fin([[-.025,.12,.1],[.025,.12,.1],[0,.72,.32],[0,.15,.7]]));
  for(const side of [-1,1]){
   bodyParts.push(fin([[side*.14,-.08,-.4],[side*.2,-.13,.28],[side*.95,-.19,.43],[side*.24,-.03,-.25]]));
   const eye=new THREE.SphereGeometry(.027,8,6);eye.translate(side*.19,.045,-1.03);bodyParts.push(tint(eye,'#111e24'));
   for(let i=0;i<3;i++){const gill=new THREE.BoxGeometry(.009,.12,.018);gill.translate(side*.268,-.025,-.3+i*.07);bodyParts.push(tint(gill,'#344a51'));}
  }
  const geometry=mergeGeometries(bodyParts)!;for(const g of bodyParts)g.dispose();const mesh=new THREE.Mesh(geometry,material);this.root.add(mesh);
  this.tail.position.z=.82;this.root.add(this.tail);const tail=mergeGeometries([fin([[-.05,0,0],[.05,0,0],[0,.55,.56],[0,-.32,.6]]),fin([[-.04,0,0],[.04,0,0],[0,.04,.75],[0,.04,.2]])])!;this.tail.add(new THREE.Mesh(tail,material));
  this.root.scale.setScalar(1.15);this.root.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 }
 update(now:number,camera:THREE.Vector3,underwater:boolean){
  if(!underwater){this.root.visible=false;this.entered=false;return;}
  if(!this.entered){this.entered=true;this.started=-Infinity;this.next=now+3500;}
  if(now>=this.next){this.angle=Math.atan2(camera.z/ISLAND_SIZE.z,camera.x/ISLAND_SIZE.x)-.28;this.started=now;this.next=now+33000+(this.passes++%3)*3500;}
  const elapsed=(now-this.started)/1000;this.root.visible=elapsed>=0&&elapsed<14;if(!this.root.visible)return;
  const angle=this.angle+elapsed*.038,r=islandCoast(angle)*1.285,x=Math.cos(angle)*ISLAND_SIZE.x*r,z=Math.sin(angle)*ISLAND_SIZE.z*r;
  this.root.position.set(x,-1.55+Math.sin(elapsed*.7)*.08,z);
  const next=angle+.005,nr=islandCoast(next)*1.285,dx=Math.cos(next)*ISLAND_SIZE.x*nr-x,dz=Math.sin(next)*ISLAND_SIZE.z*nr-z;this.root.rotation.y=Math.atan2(-dx,-dz);this.root.rotation.z=Math.sin(elapsed*1.7)*.015;this.tail.rotation.y=Math.sin(elapsed*3.5)*.25;
 }
 reset(){this.entered=false;this.root.visible=false;}
}
