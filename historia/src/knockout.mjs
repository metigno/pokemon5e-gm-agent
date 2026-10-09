/**
 * Single-elimination bracket. Entrants are taken ONLY from finalized group
 * standings. Cross-group pairings: A1-B2, C1-D2, E1-F2, G1-H2,
 * B1-A2, D1-C2, F1-E2, H1-G2.
 * Tied group positions require a verified tiebreak decision, never alphabetic order.
 */
const letters='ABCDEFGH';
export function createRoundOf16(groupRankings) {
 if(!groupRankings||Object.keys(groupRankings).sort().join('')!==letters)throw new Error('Eight finalized groups required');
 const qualifiers={};
 for(const g of letters){
  const rows=groupRankings[g];
  if(!Array.isArray(rows)||rows.length!==4||rows.some(x=>typeof x.id!=='string'||!x.id))throw new Error('Invalid standings for '+g);
  if(new Set(rows.map(x=>x.id)).size!==4)throw new Error('Duplicate group participant');
  if(rows.some(x=>x.finalized!==true))throw new Error('Unfinalized standings '+g);
  qualifiers[g]=rows;
 }
 const pair=[['A',0,'B',1],['C',0,'D',1],['E',0,'F',1],['G',0,'H',1],['B',0,'A',1],['D',0,'C',1],['F',0,'E',1],['H',0,'G',1]];
 const games=pair.map(([a,ai,b,bi],i)=>({id:`R16-${i+1}`,stage:'round-of-16',slot:i+1,homeId:qualifiers[a][ai].id,awayId:qualifiers[b][bi].id,status:'scheduled'}));
 if(new Set(games.flatMap(m=>[m.homeId,m.awayId])).size!==16)throw new Error('Duplicate qualified entrant');
 return games;
}
export function advanceRound(previous,stage) {
 const nextStages={'round-of-16':'quarterfinal','quarterfinal':'semifinal','semifinal':'final'};
 if(nextStages[stage]===undefined)throw new Error('No further round');
 const games=previous.filter(x=>x.stage===stage);
 const expected={'round-of-16':8,'quarterfinal':4,'semifinal':2}[stage];
 if(games.length!==expected||games.some(x=>x.status!=='complete'||!x.result||!x.result.winnerId))throw new Error('Round incomplete');
 const winners=games.map(x=>x.result.winnerId);
 if(new Set(winners).size!==expected)throw new Error('Duplicate winners');
 return Array.from({length:expected/2},(_,i)=>({id:`${nextStages[stage]}-${i+1}`,stage:nextStages[stage],slot:i+1,homeId:winners[i*2],awayId:winners[i*2+1],status:'scheduled'}));
}
export function crownChampion(finalGames) {
 if(finalGames.length!==1||finalGames[0].stage!=='final'||finalGames[0].status!=='complete'||!finalGames[0].result?.winnerId)throw new Error('Final incomplete');
 return finalGames[0].result.winnerId;
}
