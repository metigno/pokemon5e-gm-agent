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
