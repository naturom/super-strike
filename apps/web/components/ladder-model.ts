import * as THREE from 'three';
import type {Ladder} from '@sirocco/shared';
import type {WorldArt} from './world';

export function buildLadders(art:WorldArt,parent:THREE.Group,ladders:readonly Ladder[]){
 const yellow=art.material('#d4ab4d',{roughness:.78,metalness:.22}),steel=art.metal;
 for(const ladder of ladders){
  const group=new THREE.Group();group.name=ladder.id;group.position.set(ladder.x,0,ladder.z);group.rotation.y=Math.atan2(ladder.normal.x,ladder.normal.z);parent.add(group);
  const height=ladder.top-ladder.bottom,rail=ladder.width/2;
  for(const side of [-1,1]){
   art.box(group,.065,height+.75,.065,steel,side*rail,ladder.bottom+(height+.75)/2,-.34);
   art.box(group,.08,.07,.61,yellow,side*rail,ladder.top+.75,-.645);
   for(let y=ladder.bottom+.45;y<ladder.top;y+=2){
    art.box(group,.07,.10,.23,steel,side*rail,y,-.455);
    art.box(group,.14,.18,.03,steel,side*rail,y,-.545);
   }
  }
  for(let y=ladder.bottom+.22;y<ladder.top;y+=.29)art.box(group,ladder.width,.045,.065,Math.round((y-ladder.bottom)/.29)%6===0?yellow:steel,0,y,-.34);
  art.sign(group,ladder.side==='outside'?'RETURN ↑':'LOOKOUT ↑',-1.4,ladder.bottom+1.8,-.53,0,'#315c49',1.65);
 }
}
