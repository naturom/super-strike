import React from 'react';
import {MAPS,type MapId} from '@sirocco/shared';
export function RoomMapPicker({isHost,current,pending,shuffling,disabled,onChange,onRandomize}:{isHost:boolean;current:MapId;pending:MapId|null;shuffling:boolean;disabled:boolean;onChange:(mapId:MapId)=>void;onRandomize:()=>void}){
 if(!isHost)return <p className="fine-print">Only the room host can change maps or randomize teams.</p>;
 return <fieldset className="room-map-picker" disabled={disabled||!!pending||shuffling}><legend>ROOM OPTIONS</legend><span className="room-control-label">CHANGE MAP</span><div>{Object.values(MAPS).map(map=><button type="button" key={map.id} aria-pressed={current===map.id} disabled={current===map.id} onClick={()=>onChange(map.id)}>{pending===map.id?'SWITCHING…':map.name}</button>)}</div><button className="shuffle-teams" type="button" onClick={onRandomize}>{shuffling?'RANDOMIZING…':'RANDOMIZE TEAMS'}</button><small>Either action starts a fresh game. Keeps this room link.</small></fieldset>;
}
