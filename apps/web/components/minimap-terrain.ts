import {MAPS,type MapId} from '@sirocco/shared';

const cached=new Map<MapId,string>();
/** The browser rasterizes this immutable terrain once. Dynamic player/bomb
 * markers remain separate SVG elements, without thousands of live DOM patches. */
export function minimapTerrain(mapId:MapId){
 let image=cached.get(mapId);if(image)return image;const map=MAPS[mapId],b=map.bounds!;
 const shape=(solid:typeof map.solids[number],attributes:string)=>solid.polygon?`<polygon points="${solid.polygon.map(([x,z])=>`${x},${z}`).join(' ')}" ${attributes}/>`:`<rect x="${solid.x-solid.w/2}" y="${solid.z-solid.d/2}" width="${solid.w}" height="${solid.d}" ${attributes}/>`;
 const floors=map.solids.filter(s=>s.kind==='floor'&&s.label!=='Foundation').map(s=>shape(s,s.polygon?`fill="${s.label==='Sandy seabed'||mapId==='caverns'&&s.y+s.h/2<-.5?'#427c85':'#7e9165'}"`:`fill="#9caa91" opacity="${.28+Math.min(.25,s.y*.09)}"`));
 const walls=map.solids.filter(s=>s.style!=='water'&&(s.kind==='wall'||s.kind==='crate')).map(s=>shape(s,'fill="#151e1c" stroke="#bcc1a2" stroke-width=".2"'));
 image='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX} ${b.minZ} ${b.maxX-b.minX} ${b.maxZ-b.minZ}">${floors.join('')}${walls.join('')}</svg>`);cached.set(mapId,image);return image;
}
