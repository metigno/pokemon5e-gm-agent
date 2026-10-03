const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const round=n=>Math.round(n);

export const LEGACY_KEYS=[
  'tattica','strategia','prediction','mindGames',
  'conoscenza','adattamento','gestioneTeam','gestioneRischio',
];

export function validateLegacyStats(stats){
  for(const key of LEGACY_KEYS){
    if(!Number.isInteger(stats?.[key]) || stats[key] < 1 || stats[key] > 20){
      throw new Error(`Invalid ${key}: expected integer 1-20`);
    }
  }
  return true;
}

export function convertMotorToDnd(stats,physical={}){
  validateLegacyStats(stats);

  const dexterity=clamp(1,20,round(
    .50*stats.tattica +
    .30*stats.adattamento +
    .20*stats.prediction
  ));

  const intelligence=clamp(1,20,round(
    .30*stats.strategia +
    .30*stats.mindGames +
    .25*stats.conoscenza +
    .15*stats.tattica
  ));

  const wisdom=clamp(1,20,round(
    .40*stats.prediction +
    .30*stats.adattamento +
    .30*stats.gestioneRischio
  ));

  const charisma=clamp(1,20,round(
    .60*stats.gestioneTeam +
    .20*stats.tattica +
    .20*stats.adattamento
  ));

  return {
    strength: physical.strength ?? 10,
    dexterity: physical.dexterity ?? dexterity,
    constitution: physical.constitution ?? 10,
    intelligence,
    wisdom,
    charisma,
  };
}

export const LEGACY_INTENT_TO_5E={
  tatticaPositioning:{ability:'DEX',skills:['Acrobatics']},
  tatticaCommand:{ability:'CHA',skills:['Animal Handling']},
  strategia:{ability:'INT',skills:['Investigation']},
  prediction:{ability:'WIS',skills:['Insight','Perception']},
  mindGames:{ability:'INT',skills:['Investigation','Intimidation','Performance']},
  conoscenza:{ability:'INT',skills:['Nature','Investigation']},
  adattamento:{ability:'WIS',skills:['Survival','Insight']},
  gestioneTeam:{ability:'CHA',skills:['Animal Handling','Persuasion']},
  gestioneRischio:{ability:'WIS',skills:['Insight','Perception']},
};

export function abilityModifier(score){
  return Math.floor((score-10)/2);
}

export function getLegacyIntentResolution(intent){
  const resolution=LEGACY_INTENT_TO_5E[intent];
  if(!resolution) throw new Error(`Unknown legacy intent: ${intent}`);
  return resolution;
}
