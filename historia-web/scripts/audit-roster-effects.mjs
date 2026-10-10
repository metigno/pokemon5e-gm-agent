import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalTeam,canonicalDynamaxTarget,listCanonicalRosters} from '../canonical-2060-teams.mjs';
import {historiaFormat} from '../showdown-engine.mjs';
const {Battle,Teams,Dex}=createRequire(import.meta.url)('pokemon-showdown');
const raw=readFileSync(new URL('../roster-2060.data.json',import.meta.url));
const source=JSON.parse(raw);
const foe=Teams.pack(Array.from({length:6},()=>({species:'Blissey',level:100,moves:['Splash'],ability:'Natural Cure',evs:{hp:252,def:252}})));
const output={simulatorVersion:'0.11.11',format:'Historia WHAT-IF 6v6',basis:'Gen8 mechanics, inherited later data, explicit +Past/+Future',sourceSha256:createHash('sha256').update(raw).digest('hex'),officialQualifiersCertified:false,legendaryCanonicalClassificationCertified:false,trainers:[]};
for(const trainer of listCanonicalRosters()){
 const sets=Teams.unpack(canonicalTeam(trainer.id));
 const mega=sets.find(m=>Dex.items.get(m.item).megaStone||m.species==='Rayquaza'&&m.moves.includes('Dragon Ascent'));
 const target=sets.find(m=>m.species===canonicalDynamaxTarget(trainer.id));
 const probes=[];
 for(const [lead,mechanic] of [[mega,'mega'],[target,'dynamax']]){
  if(!lead)continue;
  const b=new Battle({formatid:'gen8customgame',format:historiaFormat(),seed:[4,3,2,1],p1:{name:trainer.id,team:Teams.pack([lead,...sets.filter(m=>m!==lead)])},p2:{name:'Test-only probe',team:foe}});
  const req=b.p1.activeRequest.active[0];
  const index=mechanic==='dynamax'&&lead.gigantamax?req.maxMoves.maxMoves.findIndex(m=>m.move.startsWith('gmax')):0;
  b.makeChoices('move '+(index+1)+' '+mechanic,'move 1');
  const p=b.p1.active[0];
  probes.push({mechanic,species:lead.species,resultSpecies:p.species.name,ability:p.ability,baseStats:p.species.baseStats,logKind:'actual simulator probe (test teams only)',log:b.log.join('\n')});
  b.destroy();
 }
 output.trainers.push({...trainer,sets,probes});
}
writeFileSync(new URL('../audit/roster-effects.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log('Verified '+output.trainers.length+' source rosters; wrote actual transformation evidence.');
