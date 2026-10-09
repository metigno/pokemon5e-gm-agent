/**
 * World Championship 2060 — seeding/draw foundation.
 * Input ranking and qualified players must be supplied from canonical sources.
 * No battle simulation, invented roster, or narrative outcome.
 */
export function makePots(entrants) {
  if (!Array.isArray(entrants) || entrants.length !== 32) throw new Error("Exactly 32 qualified entrants required");
  const ids = entrants.map(x => x.id);
  if (ids.some(x => typeof x !== "string" || !x.trim()) || new Set(ids).size !== 32) throw new Error("Unique nonempty entrant IDs required");
  if (entrants.some(x => !Number.isFinite(x.rankingPoints) || x.rankingPoints < 0)) throw new Error("Verified nonnegative rankingPoints required");
  const sorted = [...entrants].sort((a,b) => b.rankingPoints-a.rankingPoints || a.id.localeCompare(b.id));
  return [0,1,2,3].map(i => sorted.slice(i*8,(i+1)*8));
}
export function drawGroups(entrants, seed) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error("Nonnegative integer draw seed required");
  const pots = makePots(entrants);
  let state = seed >>> 0;
  function rand() { state = (Math.imul(1664525,state) + 1013904223) >>> 0; return state / 4294967296; }
  const groups = Object.fromEntries("ABCDEFGH".split("").map(x => [x,[]]));
  for (const pot of pots) {
    const shuffled=[...pot];
    for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    "ABCDEFGH".split("").forEach((g,i)=>groups[g].push(shuffled[i]));
  }
  return {year:2060,seed,pots,groups,status:"drawn",results:[]};
}
export function recordBattle(tournament, result) {
  if (!result || typeof result.battleId !== "string" || !result.battleId || !["showdown-verified"].includes(result.authority)) throw new Error("Only verified Showdown results accepted");
  if (!result.winnerId || !result.loserId || result.winnerId === result.loserId) throw new Error("Invalid participants");
  const ids=new Set(Object.values(tournament.groups).flat().map(x=>x.id));
  if (!ids.has(result.winnerId) || !ids.has(result.loserId)) throw new Error("Unknown participant");
  if (tournament.results.some(x=>x.battleId===result.battleId)) throw new Error("Duplicate battle ID");
  return {...tournament,results:[...tournament.results,{...result}]};
}

/**
 * Generate a fresh unpredictable seed ONCE when starting a new tournament.
 * Persist the returned seed and draw with the save. Never regenerate on load.
 * randomUint32 is injected by the platform adapter (e.g. crypto.randomBytes).
 */
export function startNewTournament(entrants, randomUint32, year=2060) {
  if (typeof randomUint32 !== "function") throw new Error("A cryptographic seed generator is required");
  if (!Number.isInteger(year) || year < 2060 || (year-2060)%4!==0) throw new Error("Invalid championship year");
  const seed=randomUint32();
  if (!Number.isInteger(seed) || seed<0 || seed>0xffffffff) throw new Error("Seed must be uint32");
  return {...drawGroups(entrants,seed),year,editionId:`wc-${year}-${seed.toString(16).padStart(8,'0')}`};
}
/** Restore the exact same draw and results; no reroll on load. */
export function restoreTournament(saved) {
  if (!saved || !Number.isInteger(saved.seed) || !saved.groups || !Array.isArray(saved.results)) throw new Error("Invalid tournament save");
  return structuredClone(saved);
}
