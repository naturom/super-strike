import type {Room} from '@colyseus/sdk';
import React,{memo} from 'react';
import {LatencyMeter} from './LatencyMeter';
import {minimapTerrain} from './minimap-terrain';
import {BOMB_TARGET,MAPS,type MapId,type Snapshot,type Player} from '@sirocco/shared';
// Cave terrain has thousands of immutable patches. Player snapshots only move
// markers; they must not recreate and reconcile the terrain twenty times a second.
const MinimapTerrain=memo(function MinimapTerrain({mapId}:{mapId:MapId}){
 const b=MAPS[mapId].bounds!;return <image x={b.minX} y={b.minZ} width={b.maxX-b.minX} height={b.maxZ-b.minZ} href={minimapTerrain(mapId)} aria-hidden="true"/>;
});
export function Minimap({snapshot,me,room}:{snapshot:Snapshot;me:Player;room:Room|null}){
  const map=MAPS[snapshot.mapId];if(!map.bounds)return null;
  const {minX,maxX,minZ,maxZ}=map.bounds;
  const location=map.landmarks?.reduce((a,b)=>Math.hypot(b.x-me.x,b.z-me.z)<Math.hypot(a.x-me.x,a.z-me.z)?b:a);
  return <aside className="radar" aria-label={`Map radar. Near ${location?.name??'spawn'}`}>
    <svg viewBox={`${minX} ${minZ} ${maxX-minX} ${maxZ-minZ}`} role="img" aria-label={`${map.name} layout with your position and teammates`}>
      <rect x={minX} y={minZ} width={maxX-minX} height={maxZ-minZ} fill={map.id==='market'?'#24283c':map.id==='island'?'#24515a':'#23302e'}/>
      <MinimapTerrain mapId={map.id}/>
      {map.landmarks?.filter(l=>l.name==='A'||l.name==='B').map(l=><text key={l.name} x={l.x} y={l.z} fill={snapshot.mode==='defusal'&&l.name!==BOMB_TARGET[me.team]?'#8dc9e5':'#f5c17b'} textAnchor="middle" fontSize="6" fontWeight="700">{l.name}</text>)}
      {map.ladders?.map(l=><g key={l.id} transform={`translate(${l.x} ${l.z})`}><title>{`${l.label} ladder`}</title><path d="M -1 -1 L -1 1 M 1 -1 L 1 1 M -1 -.6 L 1 -.6 M -1 .6 L 1 .6" fill="none" stroke="#f0c467" strokeWidth=".5"/></g>)}
      {snapshot.players.filter(p=>p.hp>0&&p.team===me.team&&p.id!==me.id).map(p=><circle key={p.id} cx={p.x} cy={p.z} r="1.5" fill="#8dc9e5"/>)}
      {snapshot.bombs.filter(b=>b.status==='planted'||b.team===me.team&&b.status==='dropped').map(b=><g key={b.team} transform={`translate(${b.x} ${b.z})`}><rect x="-2" y="-2" width="4" height="4" fill={b.team===me.team?'#f5c17b':'#ff765d'}/><text y="-3" textAnchor="middle" fontSize="4" fill="#ffe4b9">{b.team===me.team?'YOUR C4':'ENEMY C4'}</text></g>)}
      <g transform={`translate(${me.x} ${me.z}) rotate(${-me.yaw*180/Math.PI})`}><path d="M 0 -4 L -2.2 2 L 0 1 L 2.2 2 Z" fill="#fff4cb" stroke="#15221b" strokeWidth=".5"/></g>
    </svg><span>{location?.name??map.name.toUpperCase()}</span><LatencyMeter room={room}/>
  </aside>;
}
