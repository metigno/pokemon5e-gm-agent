import { typeMultiplier } from "./type-chart.mjs";
const PROFILES=Object.freeze({
 easy:Object.freeze({id:"easy",lookahead:0,preferDamage:false,useStatus:false,preserveResources:false}),
 medium:Object.freeze({id:"medium",lookahead:0,preferDamage:true,useStatus:true,preserveResources:false}),
 hard:Object.freeze({id:"hard",lookahead:1,preferDamage:true,useStatus:true,preserveResources:true}),
 veryHard:Object.freeze({id:"very-hard",lookahead:2,preferDamage:true,useStatus:true,preserveResources:true})
});

export function npcDifficultyProfile(id="hard"){
 const key=String(id).toLowerCase().replace(/_/g,"-");
 const profile=PROFILES[key]??PROFILES.hard;
 return structuredClone(profile);
}

function moveUtility(move,{targetHpRatio=1,selfHpRatio=1}={}){
 let score=0;
 const isDamage=Boolean(move.attack&&move.dice?.type==="damage");
 const text=String(move.description??"").toLowerCase();
 if(isDamage) score+=40;
 if(move.time?.unit==="action") score+=8;
 if(/paraly|poison|burn|sleep|frozen|confus|flinch/.test(text)) score+=targetHpRatio>0.25?18:4;
 if(/advantage|armor class|\bac\b|resistan|temporary hit points|heal/.test(text)) score+=selfHpRatio<0.55?16:8;
 if(/switch|cannot flee|restrain|speed/.test(text)) score+=8;
 return score;
}

export function chooseNpcMove(legalMoves,{difficulty="hard",targetHpRatio=1,selfHpRatio=1}={}){
 if(!Array.isArray(legalMoves)||legalMoves.length===0) return null;
 const profile=npcDifficultyProfile(difficulty);
 if(profile.id==="easy") return legalMoves[0];
 const scored=legalMoves.map((move,index)=>({move,index,score:moveUtility(move,{targetHpRatio,selfHpRatio})}));
 scored.sort((a,b)=>b.score-a.score||a.index-b.index);
 return scored[0].move;
}

export function chooseNpcTurnPlan({legalMoves=[],bench=[],active,target,knowledge=null,difficulty="hard"}={}){
 const move=chooseNpcMove(legalMoves,{difficulty,targetHpRatio:target?.hp?.max>0?target.hp.current/target.hp.max:1,selfHpRatio:active?.hp?.max>0?active.hp.current/active.hp.max:1});
 const profile=npcDifficultyProfile(difficulty);
 const threat=assessPublicThreat(knowledge);
 const activeRatio=active?.hp?.max>0?active.hp.current/active.hp.max:1;
 const healthy=bench.map((pokemon,index)=>({pokemon,index})).filter(x=>x.pokemon?.hp?.current>0);
 if(profile.id!=="easy"&&healthy.length){
  const stayScore=scoreNpcStay(active,{knowledge});
  const ranked=healthy.map(x=>({...x,score:scoreNpcSwitchCandidate(x.pokemon,{knowledge,active,bench})})).sort((a,b)=>b.score-a.score||a.index-b.index);
  const best=ranked[0];
  const future=criticalDecisionLookahead({profile,stayScore,switchScore:best.score,active,candidate:best.pokemon,knowledge});
  const margin=profile.id==="very-hard"?4:10;
  if(threat.score>=40&&future.switch>=future.stay+margin) return {kind:"switch",benchIndex:best.index,reason:"continuation_value",score:future.switch,stayScore:future.stay,lookahead:profile.lookahead};
 }
 return move?{kind:"move",moveId:move.id,reason:"best_legal_move"}:{kind:"end",reason:"no_legal_action"};
}

export function assessPublicThreat(view){
 const target=view?.player;
 if(!target?.hp?.max) return {score:0,reasons:[]};
 let score=50;
 const reasons=[];
 const hpRatio=target.hp.current/target.hp.max;
 if(hpRatio>0.7){score+=10;reasons.push("target_healthy");}
 if(hpRatio<=0.3){score-=15;reasons.push("target_low_hp");}
 const revealed=(view.revealedPlayerMoves??[]).length;
 score+=Math.min(20,revealed*4);
 if(revealed) reasons.push("revealed_moves");
 const statusValues=Object.values(target.statuses??{});
 if(statusValues.some(Boolean)){score-=8;reasons.push("target_statused");}
 return {score:Math.max(0,Math.min(100,score)),reasons};
}

function statusPenalty(statuses={}){
 return Object.values(statuses).some(Boolean)?10:0;
}
function setupValue(pokemon){
 const s=pokemon?.setup??{};
 return Math.max(0,Number(s.attack??0))*5+Math.max(0,Number(s.ac??0))*5+Math.max(0,Number(s.damage??0))*5;
}
export function scoreNpcSwitchCandidate(candidate,{knowledge=null,active=null,bench=[]}={}){
 if(!candidate?.hp?.max||candidate.hp.current<=0) return -Infinity;
 let score=50+(candidate.hp.current/candidate.hp.max)*25-statusPenalty(candidate.statuses);
 const revealed=knowledge?.revealedPlayerMoves??[];
 const targetTypes=knowledge?.player?.types??[];
 for(const move of revealed){
  const attackType=typeof move==="object"?move.type:null;
  if(!attackType) continue;
  const mult=typeMultiplier(attackType,candidate.types??[]);
  if(mult===0) score+=22;
  else if(mult===0.5) score+=12;
  else if(mult===2) score-=20;
 }
 score-=setupValue(active);
 score-=reservePreservationCost(candidate,bench,{knowledge});
 score+=continuationValue(candidate,{knowledge})*0.2;
 if(targetTypes.length&&candidate.types?.length) score+=0;
 return score;
}
export function scoreNpcStay(active,{knowledge=null}={}){
 if(!active?.hp?.max) return -Infinity;
 return 45+(active.hp.current/active.hp.max)*30+setupValue(active)-statusPenalty(active.statuses);
}

export function continuationValue(pokemon,{knowledge=null}={}){
 if(!pokemon?.hp?.max||pokemon.hp.current<=0) return 0;
 const hpRatio=pokemon.hp.current/pokemon.hp.max;
 let value=hpRatio*35+Math.min(20,Number(pokemon.level??1));
 value-=statusPenalty(pokemon.statuses);
 const revealed=knowledge?.revealedPlayerMoves??[];
 let defensiveEdge=0;
 for(const move of revealed){
  const type=typeof move==="object"?move.type:null;
  if(!type) continue;
  const mult=typeMultiplier(type,pokemon.types??[]);
  if(mult===0) defensiveEdge=Math.max(defensiveEdge,18);
  else if(mult===0.5) defensiveEdge=Math.max(defensiveEdge,10);
  else if(mult===2) defensiveEdge=Math.min(defensiveEdge,-12);
 }
 return Math.max(0,value+defensiveEdge);
}
export function reservePreservationCost(candidate,bench,{knowledge=null}={}){
 const values=(bench??[]).filter(p=>p?.hp?.current>0).map(p=>continuationValue(p,{knowledge}));
 if(!values.length) return 0;
 const best=Math.max(...values);
 const own=continuationValue(candidate,{knowledge});
 return own>=best&&values.length>1?12:0;
}

export function criticalDecisionLookahead({profile,stayScore,switchScore,active, candidate,knowledge}={}){
 const depth=Number(profile?.lookahead??0);
 if(depth<=0) return {stay:stayScore,switch:switchScore};
 let stay=stayScore+continuationValue(active,{knowledge})*(depth===1?0.08:0.12);
 let sw=switchScore+continuationValue(candidate,{knowledge})*(depth===1?0.10:0.16);
 return {stay,switch:sw};
}
