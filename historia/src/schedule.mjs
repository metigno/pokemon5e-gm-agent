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
