import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {DOG_RULES,type Dog,type Team} from '@sirocco/shared';
import {WorldArt,disposeGroup} from './world';
const palettes=new WeakMap<WorldArt,{tan:THREE.Material;black:THREE.Material;dark:THREE.Material;eye:THREE.Material;pink:THREE.Material;red:THREE.Material;blue:THREE.Material;bar:THREE.Material;barRed:THREE.Material;barBlue:THREE.Material}>();
function palette(art:WorldArt){let p=palettes.get(art);if(!p){p={tan:art.material('#b78b50',{roughness:.92}),black:art.material('#292821',{roughness:.96}),dark:art.material('#181e1c',{roughness:.52}),eye:art.material('#ad7337',{roughness:.25}),pink:art.material('#ab6867',{roughness:.8}),red:art.material('#c45f43'),blue:art.material('#568fa9'),bar:new THREE.MeshBasicMaterial({color:'#14251c'}),barRed:new THREE.MeshBasicMaterial({color:'#ea9975'}),barBlue:new THREE.MeshBasicMaterial({color:'#87d0e8'})};art.materials.push(p.bar,p.barRed,p.barBlue);palettes.set(art,p);}return p;}
function oval(parent:THREE.Object3D,size:number[],at:number[],material:THREE.Material){const g=new THREE.SphereGeometry(1,16,10);g.scale(size[0],size[1],size[2]);const mesh=new THREE.Mesh(g,material);mesh.position.fromArray(at);parent.add(mesh);return mesh;}
function link(parent:THREE.Object3D,a:number[],b:number[],r1:number,r2:number,m:THREE.Material){const from=new THREE.Vector3().fromArray(a),to=new THREE.Vector3().fromArray(b),g=new THREE.CylinderGeometry(r2,r1,from.distanceTo(to),10);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));g.translate(...from.add(to).multiplyScalar(.5).toArray());parent.add(new THREE.Mesh(g,m));}
function batch(root:THREE.Group){for(const child of root.children)if(child instanceof THREE.Group)batch(child);const groups=new Map<THREE.Material,THREE.BufferGeometry[]>();for(const o of [...root.children])if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){o.updateMatrix();const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrix),list=groups.get(o.material)??[];g.deleteAttribute('uv');list.push(g);groups.set(o.material,list);o.geometry.dispose();root.remove(o);}for(const [m,geometries] of groups){const g=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(g){const mesh=new THREE.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}}}
/** Thin coat patch follows the ribs instead of a separate rounded shell. */
function saddle(parent:THREE.Group,material:THREE.Material){
 const points:number[]=[],indices:number[]=[],rows=16,cols=16;
 for(let row=0;row<=rows;row++){
  const t=row/rows,z=-.29+t*.60,r=Math.sqrt(1-(z/.38)**2),edge=1.35+.38*Math.sin(t*Math.PI);
  for(let col=0;col<=cols;col++){const angle=(col/cols*2-1)*edge;points.push(Math.sin(angle)*(.153*r),.452+Math.cos(angle)*(.186*r),.025+z);}
 }
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals();parent.add(new THREE.Mesh(geometry,material));
}
/** Broad at the skull, pointed at the tip, with a recessed inner ear. */
function shepherdEar(parent:THREE.Group,side:number,tan:THREE.Material,dark:THREE.Material){
 const ear=new THREE.Group();ear.position.set(side*.079,.105,.005);ear.rotation.z=-side*.13;parent.add(ear);
 const vertices=[-.054,0,0, .054,0,0, side*.012,.225,.023, 0,.06,.054],geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,2,1,0,3,2,2,3,1,1,3,0]);geometry.computeVertexNormals();ear.add(new THREE.Mesh(geometry,tan));
 const inset=new THREE.BufferGeometry();inset.setAttribute('position',new THREE.Float32BufferAttribute([-.034,.027,-.002,.034,.027,-.002,side*.009,.187,.017],3));inset.setIndex([0,2,1]);inset.computeVertexNormals();ear.add(new THREE.Mesh(inset,dark));
}
export function buildDog(art:WorldArt,team:Team){
 const p=palette(art),root=new THREE.Group();root.name='dog-companion';root.userData.breed='german-shepherd';
 const body=new THREE.Group();body.name='dog-body';root.add(body);
 // Lean ribs, deep chest and a gently descending back, characteristic of a working shepherd.
 oval(body,[.152,.185,.38],[0,.452,.025],p.tan);saddle(body,p.black);
 oval(body,[.149,.218,.16],[0,.448,-.235],p.tan);oval(body,[.135,.16,.15],[0,.55,-.235],p.black);
 oval(body,[.132,.155,.15],[0,.427,.285],p.tan);
 const head=new THREE.Group();head.name='dog-head';head.position.set(0,.665,-.34);body.add(head);
 oval(head,[.111,.128,.153],[0,.025,-.058],p.tan);oval(head,[.108,.096,.125],[0,.072,-.045],p.black);
 // Wedge-shaped muzzle with the dark facial mask, tan cheeks and amber eyes.
 oval(head,[.083,.075,.135],[0,-.021,-.173],p.black);
 link(head,[0,-.026,-.16],[0,-.038,-.335],.074,.043,p.black);
 oval(head,[.049,.035,.026],[0,-.029,-.343],p.dark);
 for(const side of [-1,1]){
  shepherdEar(head,side,p.tan,p.black);
  oval(head,[.036,.067,.072],[side*.076,-.021,-.105],p.tan);
  oval(head,[.024,.018,.014],[side*.095,.047,-.137],p.dark);oval(head,[.011,.012,.009],[side*.104,.048,-.144],p.eye);
  oval(head,[.022,.011,.016],[side*.079,.082,-.122],p.tan);
 }
 const jaw=new THREE.Group();jaw.name='dog-jaw';jaw.position.set(0,-.066,-.10);head.add(jaw);oval(jaw,[.058,.025,.12],[0,-.008,-.105],p.dark);oval(jaw,[.029,.008,.065],[0,.014,-.15],p.pink);
 const collar=new THREE.Mesh(new THREE.TorusGeometry(.126,.016,6,18),team==='red'?p.red:p.blue);collar.position.set(0,.603,-.285);collar.rotation.x=.35;body.add(collar);
 const legs:THREE.Group[]=[];
 for(const front of [true,false])for(const side of [-1,1]){
  const leg=new THREE.Group();leg.name=`dog-${front?'front':'rear'}-${side<0?'left':'right'}`;leg.position.set(side*.116,.415,front?-.235:.275);root.add(leg);legs.push(leg);
  if(front){
   oval(leg,[.047,.096,.06],[0,-.035,.015],p.tan);
   link(leg,[0,-.045,.015],[0,-.225,.025],.041,.028,p.tan);link(leg,[0,-.225,.025],[0,-.345,.005],.028,.022,p.tan);oval(leg,[.029,.035,.030],[0,-.225,.025],p.tan);
  }else{
   // Powerful thigh, forward stifle, rear hock and upright pastern, rather than straight tubes.
   oval(leg,[.064,.105,.085],[0,-.025,.014],p.tan);
   link(leg,[0,-.045,.025],[0,-.18,-.069],.053,.032,p.tan);link(leg,[0,-.18,-.069],[0,-.285,.058],.031,.023,p.tan);link(leg,[0,-.285,.058],[0,-.355,.035],.023,.020,p.tan);oval(leg,[.032,.035,.033],[0,-.18,-.069],p.tan);oval(leg,[.024,.029,.026],[0,-.285,.058],p.tan);
  }
  oval(leg,[.038,.033,.065],[0,-.375,front?-.026:.006],p.tan);
 }
 const tail=new THREE.Group();tail.name='dog-tail';tail.position.set(0,.49,.35);body.add(tail);
 const tailPoints=[[0,0,0],[0,-.055,.16],[0,-.17,.29],[0,-.29,.35],[0,-.31,.40]];
 const curve=new THREE.CatmullRomCurve3(tailPoints.map(point=>new THREE.Vector3().fromArray(point))),fur=new THREE.TubeGeometry(curve,20,.05,8,false),positions=fur.getAttribute('position');
 for(let i=0;i<positions.count;i++){const u=Math.floor(i/9)/20,center=curve.getPointAt(u),radius=.9*(1-u)+.28*Math.sin(Math.PI*u)+.04;positions.setXYZ(i,center.x+(positions.getX(i)-center.x)*radius,center.y+(positions.getY(i)-center.y)*radius,center.z+(positions.getZ(i)-center.z)*radius);}
 fur.computeVertexNormals();tail.add(new THREE.Mesh(fur,p.black));
 batch(root);
 const health=new THREE.Group();health.name='dog-health';health.position.y=1.06;root.add(health);
 const background=new THREE.Mesh(new THREE.PlaneGeometry(.46,.065),p.bar),fill=new THREE.Mesh(new THREE.PlaneGeometry(.42,.033),team==='red'?p.barRed:p.barBlue);fill.position.z=.002;health.add(background,fill);
 root.userData.parts={body,head,jaw,legs,tail,health,healthFill:fill};return root;
}
export function poseDog(model:THREE.Group,dog:Dog,time:number,phase:number,speed:number){
 const {body,head,jaw,legs,tail}=model.userData.parts,alive=dog.hp>0,weight=alive?Math.min(1,speed/2):0,bite=dog.state==='attack'?Math.max(0,Math.sin(Math.min(1,(time-dog.attackAt)/600)*Math.PI)):0;
 body.position.y=Math.cos(phase*2)*.014*weight;body.rotation.set(-.025*weight,0,0);head.rotation.x=-.16*bite;jaw.rotation.x=.55*bite;
 legs.forEach((leg:THREE.Group,i:number)=>leg.rotation.x=alive?Math.sin(phase+(i===0||i===3?0:Math.PI))*.60*weight:.7);
 tail.rotation.y=alive?Math.sin(time*.012)*.17:0;model.rotation.set(0,dog.yaw,alive?0:Math.min(1,(time-dog.deadAt)/450)*Math.PI*.48);
}
export class DogModels{
 private models=new Map<string,{model:THREE.Group;phase:number}>();
 constructor(private art:WorldArt,private scene:THREE.Scene){}
 clear(){for(const {model} of this.models.values())disposeGroup(model);this.models.clear();}
 update(dogs:Dog[],time:number,dt:number,camera?:THREE.Camera){
  for(const dog of dogs){let state=this.models.get(dog.id);if(!state){const model=buildDog(this.art,dog.team);model.position.set(dog.x,dog.y,dog.z);state={model,phase:0};this.models.set(dog.id,state);this.scene.add(model);}
   const {model}=state,previous=model.position.clone();model.position.lerp(new THREE.Vector3(dog.x,dog.y,dog.z),1-Math.exp(-dt*20));const distance=Math.hypot(model.position.x-previous.x,model.position.z-previous.z),speed=dt>0?distance/dt:0;state.phase+=distance*3.8;poseDog(model,dog,time,state.phase,speed);
   const {health,healthFill}=model.userData.parts;health.visible=dog.hp>0;health.scale.setScalar(dog.hp>0?1:0);const ratio=THREE.MathUtils.clamp(dog.hp/DOG_RULES.hp,0,1);healthFill.scale.x=ratio;healthFill.position.x=-.21*(1-ratio);health.quaternion.copy(model.quaternion).invert();if(camera)health.quaternion.multiply(camera.getWorldQuaternion(new THREE.Quaternion()));
   if(dog.hp<=0){model.position.y=0;model.updateMatrixWorld(true);const floor=new THREE.Box3().setFromObject(model).min.y;model.position.y=dog.y-floor+.008;}
  }
  const ids=new Set(dogs.map(d=>d.id));for(const [id,{model}] of this.models)if(!ids.has(id)){disposeGroup(model);this.models.delete(id);}
 }
}
