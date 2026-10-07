// Canonical friend NPC career scripts.
// These apply ONLY when the friend is not the selected protagonist.
// They are derived from each character's final-team identity and battle style;
// player-controlled characters always make their own legal Pokemon 5e choices.
export const FRIEND_NPC_CANON={
 Luke:{
  specialization:"fire",path:"Tactician",
  finalTeam:["Arcanine-Hisui","Venusaur","Kyurem-Black","Great Tusk","Aerodactyl","Blastoise"],
  additionalSpecializations:{7:"grass",18:"dragon"},
  identity:"adaptive bulky pressure; Arcanine ace; attrition and tactical control"
 },
 Mattew:{
  specialization:"electric",path:"Ace Trainer",
  finalTeam:["Jolteon","Infernape","Gardevoir","Swampert","Corviknight","Zacian-Crowned"],
  additionalSpecializations:{7:"steel",18:"fighting"},
  identity:"technical training, optimization and direct competitive execution"
 },
 Daniel:{
  specialization:"ghost",path:"Researcher",
  finalTeam:["Gengar","Machamp","Mewtwo","Charizard","Aggron","Poliwrath"],
  additionalSpecializations:{7:"psychic",18:"fighting"},
  identity:"analysis, information and broad matchup knowledge"
 },
 Edward:{
  specialization:"water",path:"Ace Trainer",
  finalTeam:["Feraligatr","Lapras","Jolteon","Houndoom","Lugia","Tyranitar"],
  additionalSpecializations:{7:"dark",18:"ice"},
  identity:"physical pressure and battle-first execution around Feraligatr"
 },
 Fab:{
  specialization:"poison",path:"Type Master",
  finalTeam:["Weezing","Rayquaza","Electivire","Skarmory","Sceptile","Alakazam"],
  additionalSpecializations:{7:"dragon",18:"steel"},
  identity:"Weezing ace with type-driven disruption and varied supporting threats"
 }
};

export function friendNpcCanon(name,playerName){
 if(name===playerName) return null;
 const x=FRIEND_NPC_CANON[name];
 if(!x) throw new Error("Unknown canonical friend: "+name);
 return structuredClone(x);
}
