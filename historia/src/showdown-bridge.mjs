import {createHash} from 'node:crypto';
import {recordScheduledResult} from './schedule.mjs';
/**
 * Trusted-server integration boundary. Do not call this with arbitrary client
 * logs: the caller MUST retrieve the complete log from the authoritative
 * Showdown battle instance and authenticate its battleId/players.
 */
export function parseShowdownOutcome(log) {
 if(typeof log!=='string'||!log.trim())throw new Error('Battle log required');
 const lines=log.split(/\r?\n/);
 const players=new Map();
 let winner=null,ended=false;
 const fainted={p1:0,p2:0};
 for(const line of lines){
  const p=line.split('|');
  if(p[1]==='player'&&(p[2]==='p1'||p[2]==='p2')&&p[3])players.set(p[2],p[3]);
  if(p[1]==='faint'){
   const side=/^(p[12])a:/.exec(p[2]||'')?.[1];
   if(side)fainted[side]++;
  }
  if(p[1]==='win'){if(ended)throw new Error('Multiple terminal outcomes');winner=p.slice(2).join('|');ended=true;}
  if(p[1]==='tie')throw new Error('Draw requires explicit tournament policy');
 }
 if(players.size!==2||!ended||!winner)throw new Error('Battle log missing players or terminal win');
 const names=[...players.values()];
 if(names[0]===names[1]||!names.includes(winner))throw new Error('Winner not one of the two players');
 const winnerSide=[...players.entries()].find(([,name])=>name===winner)?.[0];
 const loserSide=winnerSide==='p1'?'p2':'p1';
 const koDifferential={};
 koDifferential[winner]=fainted[loserSide]-fainted[winnerSide];
 koDifferential[players.get(loserSide)]=-koDifferential[winner];
 return {winnerName:winner,loserName:names.find(n=>n!==winner),koDifferential,
  logDigest:'sha256:'+createHash('sha256').update(log).digest('hex')};
}
export function applyAuthoritativeShowdownResult(schedule,matchId,{battleId,log,playerNames,verifiedByServer}){
 if(verifiedByServer!==true)throw new Error('Authoritative server verification required');
 if(typeof battleId!=='string'||!/^battle-[a-z0-9-]+$/i.test(battleId))throw new Error('Invalid battle ID');
 const fixture=schedule.find(x=>x.id===matchId);
 if(!fixture||fixture.status!=='scheduled')throw new Error('Match not scheduled');
 if(!playerNames||typeof playerNames!=='object')throw new Error('Server player mapping required');
 const outcome=parseShowdownOutcome(log);
 const home=playerNames[fixture.homeId],away=playerNames[fixture.awayId];
 if(typeof home!=='string'||typeof away!=='string'||!home||!away||home===away)throw new Error('Invalid player mapping');
 if(new Set([home,away]).size!==2||!([home,away].includes(outcome.winnerName)&&[home,away].includes(outcome.loserName)))throw new Error('Log players mismatch');
 const evidence={authority:'showdown-verified',battleId,logDigest:outcome.logDigest,
  winnerId:outcome.winnerName===home?fixture.homeId:fixture.awayId,
  loserId:outcome.loserName===home?fixture.homeId:fixture.awayId,
  koDifferential:{
   [fixture.homeId]:outcome.koDifferential[home],
   [fixture.awayId]:outcome.koDifferential[away]
  }};
 return recordScheduledResult(schedule,matchId,evidence);
}
