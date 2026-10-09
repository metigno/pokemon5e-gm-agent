import {readFileSync} from 'node:fs';
/** Read-only canonical snapshot. These are 2056 entrants, NOT confirmed 2060 qualifiers. */
export function loadHistoricalSeeding(path=new URL('../data/ranking-post-2056.json',import.meta.url)){
 const data=JSON.parse(readFileSync(path,'utf8'));
 if(data.asOf!==2056 || data.ranking.length!==32)throw new Error('Invalid historical snapshot');
 for(const row of data.ranking){if(Object.values(row.coefficients).reduce((a,b)=>a+b,0)!==row.total)throw new Error('Coefficient mismatch: '+row.id);}
 return data;
}
export function canonicalComparator(a,b){
 const fields=['total',2056,2052,2048,2044];
 for(const field of fields){const va=field==='total'?a.total:a.coefficients[field],vb=field==='total'?b.total:b.coefficients[field];if(va!==vb)return vb-va;}
 // Historical snapshot has already resolved 2056 KO differential / KO scored.
 // Do not re-sort fully tied records without those verified statistics.
 return 0;
}
export function build2060SeedPots(qualifiedIds,ranking){
 if(!Array.isArray(qualifiedIds)||qualifiedIds.length!==32||new Set(qualifiedIds).size!==32)throw new Error('Exactly 32 unique confirmed qualifiers required');
 const lookup=new Map(ranking.map(r=>[r.id,r]));
 const selected=qualifiedIds.map(id=>{if(!lookup.has(id))throw new Error('No historical coefficient for '+id+'; supply verified qualification/seeding data');return lookup.get(id)});
 // Preserve canonical snapshot ordering for exact ties (KO tie-breakers).
 selected.sort((a,b)=>canonicalComparator(a,b)||a.rank-b.rank);
 return [0,1,2,3].map(i=>selected.slice(i*8,i*8+8));
}
