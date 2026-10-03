const STANDARD_ARRAY=[15,14,13,12,10,8];

export const FRIEND_STARTING_BUILDS={
  Luke:{
    abilities:{STR:8,DEX:14,CON:10,INT:12,WIS:15,CHA:13},
    skills:["Animal Handling","Insight","Survival"],
    starter:{species:"Growlithe",form:"Hisuian",level:5}
  },
  Mattew:{
    abilities:{STR:8,DEX:15,CON:10,INT:14,WIS:13,CHA:12},
    skills:["Animal Handling","Investigation","Perception"],
    starter:{species:"Eevee",form:"Standard",level:5}
  },
  Daniel:{
    abilities:{STR:8,DEX:12,CON:10,INT:15,WIS:14,CHA:13},
    skills:["Animal Handling","Investigation","Insight"],
    starter:{species:"Gastly",form:"Standard",level:5}
  },
  Edward:{
    abilities:{STR:14,DEX:13,CON:15,INT:8,WIS:10,CHA:12},
    skills:["Animal Handling","Athletics","Intimidation"],
    starter:{species:"Totodile",form:"Standard",level:5}
  },
  Fab:{
    abilities:{STR:10,DEX:8,CON:14,INT:13,WIS:12,CHA:15},
    skills:["Animal Handling","Nature","Medicine"],
    starter:{species:"Koffing",form:"Standard",level:5}
  }
};

// These are used only when the friend is an NPC.
// If the friend is selected by the player, normal Pokemon 5e/D&D choices replace the script.
export const NPC_ASI_SCRIPTS={
  Luke:{
    4:{WIS:1,CHA:1},
    8:{DEX:2},
    12:{CHA:2},
    16:{WIS:2}
  },
  Mattew:{
    4:{DEX:1,INT:1},
    8:{DEX:2},
    12:{INT:1,CHA:1},
    16:{DEX:2}
  },
  Daniel:{
    4:{INT:1,WIS:1},
    8:{INT:2},
    12:{WIS:1,CHA:1},
    16:{INT:2}
  },
  Edward:{
    4:{STR:1,CON:1},
    8:{DEX:1,CHA:1},
    12:{STR:1,CHA:1},
    16:{CON:2}
  },
  Fab:{
    4:{CHA:1,WIS:1},
    8:{CON:2},
    12:{INT:1,WIS:1},
    16:{CHA:2}
  }
};

export const LEGACY_INTENT_TO_5E={
  tatticaPositioning:{ability:"DEX",skills:["Acrobatics"]},
  tatticaCommand:{ability:"CHA",skills:["Animal Handling"]},
  strategia:{ability:"INT",skills:["Investigation"]},
  prediction:{ability:"WIS",skills:["Insight","Perception"]},
  mindGames:{ability:"INT",skills:["Investigation","Intimidation","Performance"]},
  conoscenza:{ability:"INT",skills:["Nature","Investigation"]},
  adattamento:{ability:"WIS",skills:["Survival","Insight"]},
  gestioneTeam:{ability:"CHA",skills:["Animal Handling","Persuasion"]},
  gestioneRischio:{ability:"WIS",skills:["Insight","Perception"]}
};

export function abilityModifier(score){
  return Math.floor((score-10)/2);
}

export function getStartingBuild(name){
  const build=FRIEND_STARTING_BUILDS[name];
  if(!build) throw new Error(`Unknown friend: ${name}`);
  return structuredClone(build);
}

export function npcAsiScript(name,playerName){
  if(name===playerName) return null;
  const s=NPC_ASI_SCRIPTS[name];
  if(!s) throw new Error(`Unknown friend: ${name}`);
  return structuredClone(s);
}

export function applyAsi(abilities,delta){
  const next={...abilities};
  for(const [key,value] of Object.entries(delta)){
    next[key]=Math.min(20,(next[key]??0)+value);
  }
  return next;
}

export function isBalancedStandardArray(abilities){
  const vals=Object.values(abilities).slice().sort((a,b)=>b-a);
  return JSON.stringify(vals)===JSON.stringify(STANDARD_ARRAY);
}

export function getLegacyIntentResolution(intent){
  const r=LEGACY_INTENT_TO_5E[intent];
  if(!r) throw new Error(`Unknown legacy intent: ${intent}`);
  return structuredClone(r);
}
