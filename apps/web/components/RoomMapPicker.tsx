import {MAPS,type MapId} from '@sirocco/shared';
export function RoomMapPicker({current,pending,disabled,onChange}:{current:MapId;pending:MapId|null;disabled:boolean;onChange:(mapId:MapId)=>void}){
 return <fieldset className="room-map-picker" disabled={disabled||!!pending}><legend>CHANGE MAP</legend><div>{Object.values(MAPS).map(map=><button type="button" key={map.id} aria-pressed={current===map.id} disabled={current===map.id} onClick={()=>onChange(map.id)}>{pending===map.id?'SWITCHING…':map.name}</button>)}</div><small>Starts a fresh game for everyone. Keeps this room link.</small></fieldset>;
}
