/**
 * Exact imported team source: Roster2060(2).md (user supplied, cycle 2060).
 * No generated Pokémon, no practice fallback, no opponent private sets sent
 * to the browser. Invalid canon builds are surfaced as errors, never fixed
 * by quietly swapping species, items, moves or mechanics.
 */
import {createRequire} from 'node:module';
import {parseTeamInput,describeTeam} from './battle-service.mjs';
const require=createRequire(import.meta.url);
const roster=require('./canonical-rosters-2060.json');
const byName=new Map(Object.entries(roster.teams));
const ids=new Map();
for(const name of byName.keys()){
 const key=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 if(ids.has(key))throw Error('Ambiguous roster name: '+name);
 ids.set(key,name);
}
export const availableCanonicalTrainers=Object.freeze([...byName.keys()]);
export function getCanonicalShowdownTeam(name){
 if(typeof name!=='string'||!name.trim())throw Error('Nome allenatore canonico mancante');
 const key=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 const canonical=byName.has(name)?name:ids.get(key);
 if(!canonical)throw Error('Roster 2060 non disponibile per '+name);
 try{return parseTeamInput(byName.get(canonical),{teamLabel:canonical});}
 catch(e){throw Error('Roster 2060 di '+canonical+' incompatibile con Showdown: '+e.message);}
}
export function getCanonicalTeamPreview(name){
 return describeTeam(getCanonicalShowdownTeam(name),{teamLabel:name});
}
