import {MAPS,DEFAULT_TEAM_AVATARS,validTeamAvatars,type TeamAvatars,DEFAULT_MAP,validMap,validMode,type GameMode,type MapId} from '@sirocco/shared';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export type Invite={v:1;id:string;exp:number;mapId?:MapId;mode?:GameMode;teamAvatars?:TeamAvatars;moreFun?:boolean};
export function signer(secret:string) {
  if(Buffer.byteLength(secret)<32)throw new Error('INVITE_SECRET must contain at least 32 bytes');
  const sign=(body:string)=>createHmac('sha256',secret).update(body).digest('base64url');
  return {
    create(now=Date.now(),mapId:MapId=DEFAULT_MAP,mode:GameMode='deathmatch',teamAvatars:TeamAvatars=DEFAULT_TEAM_AVATARS,moreFun=true) {if(typeof moreFun!=='boolean')throw new Error('Invalid More fun setting');if(!validTeamAvatars(teamAvatars))throw new Error('Choose a different character for each team');const payload:Invite={v:1,id:randomBytes(16).toString('hex'),exp:now+7*86400000,mapId,mode,teamAvatars:{...teamAvatars},moreFun};const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${body}.${sign(body)}`;},
    verify(token:unknown,now=Date.now()):Invite {
      if(typeof token!=='string'||token.length>512)throw new Error('Invalid invitation');
      const [body,sig,extra]=token.split('.');if(!body||!sig||extra)throw new Error('Invalid invitation');
      const expected=Buffer.from(sign(body));const actual=Buffer.from(sig);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new Error('Invalid invitation');
      let data:Omit<Invite,'mapId'>&{mapId?:unknown};try{data=JSON.parse(Buffer.from(body,'base64url').toString());}catch{throw new Error('Invalid invitation');}
      if(data.v!==1||! /^[a-f0-9]{32}$/.test(data.id)||!Number.isSafeInteger(data.exp)||data.exp<=now)throw new Error('Invitation expired. Create a new room.');
      // Retired map invitations retain their identity and use the default arena.
      const mapId=data.mapId==='snowbound'?DEFAULT_MAP:data.mapId===undefined?'relay':data.mapId;
      if(!validMap(mapId))throw new Error('Invalid map');
      if(data.mode!==undefined&&!validMode(data.mode))throw new Error('Invalid mode');
      if(data.mode==='defusal'&&!MAPS[mapId].bombSites?.length)throw new Error('This map has no bomb sites');
      if(data.teamAvatars!==undefined&&!validTeamAvatars(data.teamAvatars))throw new Error('Invalid team characters');
      if(data.moreFun!==undefined&&typeof data.moreFun!=='boolean')throw new Error('Invalid More fun setting');
      return {...data,moreFun:data.moreFun??true,teamAvatars:{...(data.teamAvatars??DEFAULT_TEAM_AVATARS)},mapId,mode:data.mode??'deathmatch'};
    }
  };
}
