import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validatePackedTeam} from './battle-service.mjs';

const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
const source=JSON.parse(readFileSync(new URL('./roster-2060.data.json',import.meta.url),'utf8'));
const canonicalNames=Object.keys(source.teams);
const canonicalSet=new Set(canonicalNames);

/** The imported roster is game data, not official 2060 qualification evidence. */
export function listCanonicalRosters(){
 return canonicalNames.map(id=>{
  try{return {id,available:true,pokemonCount:Teams.unpack(canonicalTeam(id)).length,designatedDynamax:source.designatedDynamaxSpecies?.[id]||null};}
  catch(error){return {id,available:false,reason:error.message};}
 }).concat(source.missingExplicitTeams.map(id=>({id,available:false,reason:'Nessun team 2060 completo nel roster fornito'})));
}

/** Return an exact packed six with Gen8/Showdown flags untouched.
 * Fail-closed if the user roster references non-Showdown content (Excadrite,
 * novel Mega forms, invalid ability/item), rather than silently replacing it.
 */
export function canonicalTeam(id){
 if(typeof id!=='string'||!id.trim())throw Error('Identità allenatore non valida');
 const sets=source.teams[id];
 if(!sets){
  const detail=canonicalSet.has(id)?'':'Team 2060 non disponibile per '+id+
   ': il roster allegato non contiene sei set completi';
  throw Error(detail||'Team mancante');
 }
 if(sets.length!==6)throw Error('Squadra canonica non completa: '+id);
 const parsed=sets.map(set=>{
  const {species,item,ability,nature,moves,evs,ivs,gigantamax,shiny,name}=set;
  return {species,item,ability,nature,moves:[...moves],evs:{...evs},...(ivs?{ivs:{...ivs}}:{}),
   ...(gigantamax?{gigantamax:true}:{}),...(shiny?{shiny:true}:{}),
   ...(name?{name}:{}),level:100};
 });
 const packed=Teams.pack(parsed);
 validatePackedTeam(packed,{teamLabel:id});
 // Every rule-engine input is already exact packed Showdown text.
 const restored=Teams.unpack(packed);
 if(restored.length!==6||restored.some((set,i)=>
    set.species!==sets[i].species||
    set.item!==sets[i].item||
    !!set.gigantamax!==!!sets[i].gigantamax))
  throw Error('Importazione Showdown ha modificato forma, item o Gigamax di '+id);
 return packed;
}
export function canonicalTeamExport(id){return Teams.export(Teams.unpack(canonicalTeam(id)));}
export function canonicalDynamaxTarget(id){
 canonicalTeam(id);
 return source.designatedDynamaxSpecies?.[id]||null;
}
export const canonicalRosterMeta=Object.freeze({
 source:source.source,availableProfiles:canonicalNames.length,
 missingTeams:Object.freeze([...source.missingExplicitTeams])
});
