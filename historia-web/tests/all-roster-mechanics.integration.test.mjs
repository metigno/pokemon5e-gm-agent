import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {canonicalTeam,canonicalDynamaxTarget} from '../canonical-2060-teams.mjs';
const {Battle,Teams,Dex}=createRequire(import.meta.url)('pokemon-showdown');
import {historiaFormat} from '../showdown-engine.mjs';
const source=JSON.parse(readFileSync(new URL('../roster-2060.data.json',import.meta.url)));
const foe=Teams.pack(Array.from({length:6},()=>({species:'Blissey',level:100,moves:['Splash'],ability:'Natural Cure',evs:{hp:252,def:252}})));
for(const trainer of Object.keys(source.teams)){
 test(`${trainer}: actual Mega and designated Dynamax/G-Max use unchanged source set`,()=>{
  const sets=Teams.unpack(canonicalTeam(trainer));
  const mega=sets.find(m=>Dex.items.get(m.item).megaStone||m.species==='Rayquaza'&&m.moves.includes('Dragon Ascent'));
  const target=sets.find(m=>m.species===canonicalDynamaxTarget(trainer));
  for(const [lead,transformation]of [[mega,'mega'],[target,'dynamax']]){
   if(!lead)continue;
   const b=new Battle({formatid:'gen8customgame',format:historiaFormat(),seed:[4,3,2,1],p1:{name:trainer,team:Teams.pack([lead,...sets.filter(x=>x!==lead)])},p2:{name:'Probe',team:foe}});
   try{
    if(transformation==='mega'){
     assert.ok(b.p1.active[0].canMegaEvo,trainer+' Mega unavailable');
     b.makeChoices('move 1 mega','move 1');
     assert.equal(b.p1.active[0].species.isMega,true);
     assert.equal(b.p1.active[0].ability,Dex.species.get(b.p1.active[0].species.name).abilities[0].toLowerCase().replace(/[^a-z0-9]/g,''));
     assert.ok(b.log.some(line=>line.startsWith('|-mega|')));
    }else{
     const req=b.p1.activeRequest.active[0];assert.ok(req.canDynamax,trainer+' Dynamax unavailable');
     const move=lead.gigantamax?req.maxMoves.maxMoves.findIndex(m=>m.move.startsWith('gmax')):0;
     assert.ok(move>=0,trainer+' G-Max signature missing');
     b.makeChoices('move '+(move+1)+' dynamax','move 1');
     assert.ok(b.log.some(line=>line.startsWith('|-start|p1a:')&&line.includes('|Dynamax')));
     if(lead.gigantamax)assert.ok(b.log.some(line=>line.startsWith('|move|p1a:')&&line.includes('|G-Max ')));
    }
   }finally{b.destroy();}
  }
 });
}
