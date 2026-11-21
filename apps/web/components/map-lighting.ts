import * as THREE from 'three';
import type {MapId} from '@sirocco/shared';

/** Switching maps restores every daylight setting; nighttime is scoped to Night Market. */
export function applyMapLighting(scene:THREE.Scene,view:THREE.Scene,map:MapId,cutaway=false){
 const night=map==='market',cave=map==='caverns',sky=scene.getObjectByName('arenaSky'),sun=scene.getObjectByName('arenaSun') as THREE.DirectionalLight|undefined,ambient=scene.getObjectByName('arenaAmbient') as THREE.HemisphereLight|undefined;
 if(sky)sky.visible=!night&&!cave;
 if(sun){sun.color.set(night?'#b8c8ed':'#fff0d8');sun.intensity=cave?(cutaway?1.7:0):night?.85:3.1;}
 if(ambient){ambient.color.set(cave?'#b4c6c5':night?'#9daed3':'#d4e3ed');ambient.groundColor.set(cave?'#5c645b':night?'#34354b':'#96846b');ambient.intensity=cave?(cutaway?1.8:.85):night?.65:.85;}
 scene.background=cave?new THREE.Color(cutaway?'#253940':'#111d20'):night?new THREE.Color('#0b1428'):null;scene.environmentIntensity=cave?(cutaway?.1:.04):night?.08:.12;
 const fog=cave?(cutaway?['#253940',100,230] as const:['#18292c',18,65] as const):map==='market'?['#101c32',38,110] as const:map==='island'?['#e8f0f1',65,230] as const:map==='dunes'?['#d5cbb4',120,280] as const:['#bdcbd0',120,280] as const;
 scene.fog=new THREE.Fog(fog[0],fog[1],fog[2]);view.environmentIntensity=night?.28:.45;
 const fill=view.getObjectByName('handFill') as THREE.DirectionalLight|undefined;if(fill){fill.color.set(night?'#d9d9ea':'#ffedce');fill.intensity=night?1.8:2.5;}
 return night?1.1:.95;
}
