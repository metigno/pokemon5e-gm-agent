const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const round=n=>Math.round(n);

export const MOTOR_STAT_KEYS=[
  'tattica','strategia','prediction','mindGames',
  'conoscenza','adattamento','gestioneTeam','gestioneRischio',
];

export function abilityModifier(score){
  return Math.floor((score-10)/2);
}

export function validateMotorStats(stats){
  for(const key of MOTOR_STAT_KEYS){
    if(!Number.isInteger(stats?.[key]) || stats[key] < 1 || stats[key] > 20){
      throw new Error(`Invalid ${key}: expected integer 1-20`);
    }
  }
  return true;
}

export function tacticalChecks(stats){
  validateMotorStats(stats);
  return Object.fromEntries(
    MOTOR_STAT_KEYS.map(key=>[
      key,{score:stats[key],modifier:abilityModifier(stats[key])}
    ])
  );
}

export function projectNpcAbilities(stats,physical={}){
  validateMotorStats(stats);

  const intelligence=clamp(1,20,round(
    .45*stats.strategia + .40*stats.conoscenza + .15*stats.tattica
  ));
  const wisdom=clamp(1,20,round(
    .30*stats.prediction + .25*stats.adattamento +
    .25*stats.gestioneRischio + .20*stats.tattica
  ));
  const charisma=clamp(1,20,round(
    .45*stats.gestioneTeam + .35*stats.mindGames + .20*stats.adattamento
  ));

  const dexterity=physical.dexterity ?? clamp(
    8,16,round(10 + .35*(stats.tattica-10) + .15*(stats.prediction-10))
  );

  return {
    strength:physical.strength ?? 10,
    dexterity,
    constitution:physical.constitution ?? 10,
    intelligence,
    wisdom,
    charisma,
  };
}

export function derivedTacticalSkills(stats,proficiencyBonus=0){
  validateMotorStats(stats);
  const mean=(...values)=>values.reduce((a,b)=>a+b,0)/values.length;
  const scores={
    battleTactics:round(mean(stats.tattica,stats.strategia)),
    readOpponent:round(mean(stats.prediction,stats.mindGames)),
    pokemonKnowledge:round(mean(stats.conoscenza,stats.strategia)),
    adaptUnderPressure:round(mean(stats.adattamento,stats.gestioneRischio)),
    commandTeam:round(mean(stats.gestioneTeam,stats.tattica)),
    riskAssessment:round(mean(
      stats.gestioneRischio,stats.prediction,stats.strategia
    )),
  };

  return Object.fromEntries(Object.entries(scores).map(([key,score])=>[
    key,{
      score,
      modifier:abilityModifier(score),
      proficientModifier:abilityModifier(score)+proficiencyBonus,
    },
  ]));
}
