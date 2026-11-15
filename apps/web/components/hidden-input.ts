/** Local shortcut only; the server independently validates every summon request. */
export class HiddenInput {
 key(event:{code:string;repeat:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean}){
  return event.code==='KeyG'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
 }
}
