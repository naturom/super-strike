import * as THREE from 'three';
import type {BombSite} from '@sirocco/shared';
import type {WorldArt} from './world';

/** A physical board with separately oriented lettering on each side. */
export function islandSiteSign(art:WorldArt,site:BombSite){
 const root=new THREE.Group(),side=site.id==='A'?1:-1;root.name=`Site ${site.id} sign`;
 root.position.set(site.x+side*4,0,site.z+side*4);root.rotation.y=site.id==='A'?-Math.PI/4:3*Math.PI/4;
 const board=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,.12),art.timber);board.name='Wooden sign board';board.position.y=1.8;board.castShadow=board.receiveShadow=true;root.add(board);
 const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,1.3,8),art.timber);post.name='Sign support';post.position.y=.65;post.castShadow=post.receiveShadow=true;root.add(post);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#304b38';ctx.fillRect(0,0,512,512);ctx.strokeStyle='#e8dfc2';ctx.lineWidth=7;ctx.strokeRect(16,16,480,480);
 ctx.fillStyle='#f5edd4';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 48px sans-serif';ctx.fillText('SITE',256,90);ctx.font='bold 310px sans-serif';ctx.fillText(site.id,256,300);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;art.textures.push(texture);
 const ink=art.material('#ffffff',{map:texture,roughness:.95});
 for(const side of [1,-1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(.98,.98),ink);face.name=side>0?'Sign front':'Sign back';face.position.set(0,1.8,side*.068);face.rotation.y=side>0?0:Math.PI;root.add(face);}
 return root;
}
