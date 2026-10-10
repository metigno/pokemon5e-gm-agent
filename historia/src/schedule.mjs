/** Group stage: 3 matchdays, 2 fixtures per group per day. */
export function createGroupSchedule(groups,year=2060) {
 const letters='ABCDEFGH';
 if(!groups||Object.keys(groups).sort().join('')!==letters)throw new Error('Expected groups A-H');
 const pairings=[[[0,3],[1,2]],[[0,2],[3,1]],[[0,1],[2,3]]],matches=[];
 for(const g of letters){const members=groups[g];if(!Array.isArray(members)||members.length!==4||new Set(members.map(x=>x.id)).size!==4)throw new Error('Invalid group '+g);
 pairings.forEach((round,day)=>round.forEach(([a,b],i)=>matches.push({id:`${year}-G${g}-D${day+1}-M${i+1}`,stage:'group',group:g,matchday:day+1,homeId:members[a].id,awayId:members[b].id,status:'scheduled'})));}
 return matches;
}
export function recordScheduledResult(schedule,matchId,evidence){
 const match=schedule.find(m=>m.id===matchId);
 if(!match||match.status!=='scheduled')throw new Error('Unknown or completed match');
 if(!evidence||evidence.authority!=='showdown-verified'||!evidence.battleId||!evidence.logDigest)throw new Error('Verified battle receipt required');
 if(![match.homeId,match.awayId].includes(evidence.winnerId)||![match.homeId,match.awayId].includes(evidence.loserId)||evidence.winnerId===evidence.loserId)throw new Error('Result participants mismatch');
 if(schedule.some(m=>m.result?.battleId===evidence.battleId))throw new Error('Duplicate battle receipt');
 return schedule.map(m=>m.id===matchId?{...m,status:'complete',result:{...evidence}}:m);
}
/** Provisional 3/0 scoring; exact tie-breakers pending official rules. */
export function groupStandings(schedule,group){
 const games=schedule.filter(m=>m.group===group);if(games.length!==6)throw new Error('Group schedule incomplete');
 const ids=[...new Set(games.flatMap(m=>[m.homeId,m.awayId]))];
 const table=new Map(ids.map(id=>[id,{id,played:0,wins:0,losses:0,points:0}]));
 for(const game of games.filter(m=>m.status==='complete')){const win=table.get(game.result.winnerId),lose=table.get(game.result.loserId);win.played++;win.wins++;win.points+=3;lose.played++;lose.losses++;}
 return [...table.values()].sort((a,b)=>b.points-a.points||b.wins-a.wins||a.id.localeCompare(b.id));
}

/**
 * Provisional WHAT-IF group qualification rule (not the unconfirmed official
 * 2060 regulation):
 *  1. Three points per verified win.
 *  2. If exactly two participants tie on points, their verified head-to-head
 *     winner ranks higher.
 *  3. For a three-way points tie, use aggregate KO differential observed in
 *     the six authoritative Showdown logs of the group.
 *  4. If evidence is absent or a three-way KO tie remains, REFUSE to seed
 *     knockouts. A separate, verified playoff policy is still required.
 *
 * Never use historical rank, alphabetical name or a fresh random roll to
 * decide a tie. The order is final only if all six games were completed.
 */
export function finalizedGroupStandings(schedule,group){
 const games=schedule.filter(m=>m.stage==='group'&&m.group===group);
 if(games.length!==6||games.some(m=>m.status!=='complete'||m.result?.authority!=='showdown-verified'))
  throw Error('Girone '+group+': completare tutti e sei gli incontri Showdown prima degli ottavi');
 const rows=groupStandings(schedule,group);
 for(const row of rows)if(row.played!==3)throw Error('Girone '+group+': calendario non coerente');
 const sorted=[];
 for(const points of [...new Set(rows.map(r=>r.points))].sort((a,b)=>b-a)){
  const tied=rows.filter(r=>r.points===points);
  if(tied.length===1){sorted.push(tied[0]);continue;}
  if(tied.length===2){
   const direct=games.find(g=>new Set([g.homeId,g.awayId]).size===2&&
    tied.every(r=>[g.homeId,g.awayId].includes(r.id)));
   if(!direct||!tied.some(r=>r.id===direct.result.winnerId))
    throw Error('Girone '+group+': scontro diretto non verificato');
   sorted.push(...tied.sort((a,b)=>a.id===direct.result.winnerId?-1:1));
   continue;
  }
  // A cyclic three-way tie cannot be resolved by head-to-head alone.
  const totals=new Map(tied.map(r=>[r.id,0]));
  for(const game of games){
   if(!game.result?.koDifferential||[game.homeId,game.awayId].some(id=>
      !Number.isSafeInteger(game.result.koDifferential[id])||
      Math.abs(game.result.koDifferential[id])>6))
    throw Error('Girone '+group+': dati KO verificati mancanti; spareggio richiesto');
   for(const id of totals.keys())if(id===game.homeId||id===game.awayId)
    totals.set(id,totals.get(id)+game.result.koDifferential[id]);
  }
  tied.sort((a,b)=>totals.get(b.id)-totals.get(a.id));
  if(tied.some((row,i)=>i>0&&totals.get(row.id)===totals.get(tied[i-1].id)))
   throw Error('Girone '+group+': parità di punti e differenza KO; spareggio Showdown richiesto');
  sorted.push(...tied.map(row=>({...row,koDifference:totals.get(row.id)})));
 }
 if(sorted.length!==4||new Set(sorted.map(x=>x.id)).size!==4)throw Error('Graduatoria non univoca');
 return sorted.map((row,i)=>({...row,position:i+1,finalized:true}));
}
