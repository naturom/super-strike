import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GUNS,weaponLabel,type CombatEvent} from '@sirocco/shared';
import {KillFeed,killDescription,KILL_FEED_MS,type KillFeedEntry} from '../apps/web/components/KillFeed';

const kill=(patch:Partial<CombatEvent>={}):CombatEvent=>({id:1,type:'kill',shooter:'a',target:'b',team:'red',victimTeam:'blue',name:'Alpha',victim:'Bravo',weapon:'rifle',from:{x:0,y:0,z:0},to:{x:0,y:0,z:-3},...patch});
test('kill notices identify every gun, headshots, knife, explosives, falls, self kills and wildlife',()=>{
 for(const weapon of [...GUNS,'knife'] as const){const result=killDescription(kill({weapon}));assert.equal(result.killer,'Alpha');assert.equal(result.victim,'Bravo');assert.equal(result.method,weaponLabel(weapon));assert.match(result.label,/Alpha killed Bravo/);}
 assert.equal(killDescription(kill({hitZone:'head'})).detail,'HEADSHOT');
 assert.equal(killDescription(kill({weapon:'grenade'})).method,'FRAG GRENADE');
 assert.equal(killDescription(kill({weapon:'bomb'})).method,'C4 EXPLOSION');
 const fall=killDescription(kill({cause:'fall',shooter:'b'}));assert.equal(fall.killer,null);assert.match(fall.label,/Bravo died from fall damage/);
 const self=killDescription(kill({weapon:'grenade',shooter:'b'}));assert.equal(self.killer,null);assert.equal(self.detail,'SELF');assert.match(self.label,/Bravo killed themselves/);
 const trex=killDescription(kill({cause:'trex'}));assert.equal(trex.killer,'T-REX');assert.equal(trex.method,'MAULING');
 assert.equal(killDescription(kill({type:'trexDeath',victim:'T-REX'})).victim,'T-REX');
});
test('kill feed shows the five newest unexpired entries and highlights your kills and deaths',()=>{
 const now=Date.now(),entries:KillFeedEntry[]=Array.from({length:7},(_,id)=>({...kill({id,name:`Killer ${id}`}),at:now-700+id*100}));
 entries.unshift({...kill({id:99,name:'Expired'}),at:now-KILL_FEED_MS-100});
 const html=renderToStaticMarkup(createElement(KillFeed,{entries,localId:'a'}));
 assert.equal((html.match(/class="killfeed-row/g)??[]).length,5);assert.doesNotMatch(html,/Expired|Killer 0|Killer 1/);assert.ok(html.indexOf('Killer 6')<html.indexOf('Killer 2'));assert.match(html,/killfeed-kill/);assert.match(html,/role="log"/);assert.match(html,/team-blue/);
 const death=renderToStaticMarkup(createElement(KillFeed,{entries:[{...kill({name:'<Alpha>'}),at:now}],localId:'b'}));assert.match(death,/killfeed-death/);assert.match(death,/&lt;Alpha&gt;/);
});
