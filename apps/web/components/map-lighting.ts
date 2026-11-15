import * as THREE from 'three';
import type {MapId} from '@sirocco/shared';

/** Switching maps restores every daylight setting; nighttime is scoped to Night Market. */
export function applyMapLighting(scene:THREE.Scene,view:THREE.Scene,map:MapId){
 const night=map==='market',sky=scene.getObjectByName('arenaSky'),sun=scene.getObjectByName('arenaSun') as THREE.DirectionalLight|undefined,ambient=scene.getObjectByName('arenaAmbient') as THREE.HemisphereLight|undefined;
 if(sky)sky.visible=!night;
 if(sun){sun.color.set(night?'#b8c8ed':'#fff0d8');sun.intensity=night?.85:3.1;}
 if(ambient){ambient.color.set(night?'#9daed3':'#d4e3ed');ambient.groundColor.set(night?'#34354b':'#96846b');ambient.intensity=night?.65:.85;}
 scene.background=night?new THREE.Color('#0b1428'):null;scene.environmentIntensity=night?.08:.12;
 const fog=map==='market'?['#101c32',38,110] as const:map==='island'?['#e8f0f1',65,230] as const:map==='dunes'?['#d5cbb4',120,280] as const:['#bdcbd0',120,280] as const;
 scene.fog=new THREE.Fog(fog[0],fog[1],fog[2]);view.environmentIntensity=night?.28:.45;
 const fill=view.getObjectByName('handFill') as THREE.DirectionalLight|undefined;if(fill){fill.color.set(night?'#d9d9ea':'#ffedce');fill.intensity=night?1.8:2.5;}
 return night?1.1:.95;
}
