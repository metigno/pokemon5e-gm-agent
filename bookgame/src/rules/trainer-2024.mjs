export const P5E_2024_SOURCE={repo:"Auroratide/poke5e",ref:"b411a993eba07f36218f8ea70dd2c402e2e7c91a",edition:"2024"};

export const SPECIALIZATIONS_2024=[
["normal","poke-fan","Poké Fan","asi","cha"],["fighting","black-belt","Black Belt","proficiency","athletics"],
["flying","bird-keeper","Bird Keeper","proficiency","perception"],["poison","punk","Punk","proficiency","sleight of hand"],
["ground","camper","Camper","proficiency","survival"],["rock","hiker","Hiker","asi","con"],
["bug","bug-maniac","Bug Maniac","proficiency","nature"],["ghost","mystic","Mystic","proficiency","religion"],
["steel","worker","Worker","asi","str"],["fire","kindler","Kindler","proficiency","intimidation"],
["water","swimmer","Swimmer","asi","dex"],["grass","gardener","Gardener","proficiency","medicine"],
["electric","engineer","Engineer","asi","int"],["psychic","psychic","Psychic","proficiency","arcana"],
["ice","skier","Skier","proficiency","acrobatics"],["dragon","dragon-tamer","Dragon Tamer","asi","wis"],
["dark","delinquent","Delinquent","proficiency","stealth"],["fairy","actor","Actor","proficiency","performance"]
].map(([type,id,name,effectType,value])=>({type,id,name,effect:{type:effectType,value}}));

export const TRAINER_PATHS_2024=[
"Ace Trainer","Hobbyist","Poké Mentor","Researcher","Pokémon Collector","Nurse","Type Master",
"Commander","Grunt","Tactician","Ranger","Guru","Pokémon Breeder"
];

export function specializationByType(type){return SPECIALIZATIONS_2024.find(x=>x.type===type)??null;}
export function specializationById(id){return SPECIALIZATIONS_2024.find(x=>x.id===id)??null;}
export function isTrainerPath2024(name){return TRAINER_PATHS_2024.includes(name);}

export function trainerProgression2024(level){
 if(!Number.isInteger(level)||level<1||level>20) throw new RangeError("Trainer level must be 1..20");
 return {
  proficiencyBonus:2+Math.floor((level-1)/4),
  pokeslots:level>=15?6:level>=10?5:level>=5?4:3,
  maxSr:level>=17?15:level>=14?14:level>=11?12:level>=8?10:level>=6?8:level>=3?5:2,
  pathAvailable:level>=2,
  specializationCount:1+(level>=7?1:0)+(level>=18?1:0),
  asiOrFeat:[4,8,12,16].includes(level),
  pathFeature:[2,5,9,15].includes(level),
  pokemonTracker:level>=13,
  trainerResolve:level>=10,
  masterTrainer:level>=20
 };
}
