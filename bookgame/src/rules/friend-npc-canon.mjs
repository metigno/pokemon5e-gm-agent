// Canonical friend NPC career scripts.
// These apply ONLY when the friend is not the selected protagonist.
// They are derived from each character's final-team identity and battle style;
// player-controlled characters always make their own legal Pokemon 5e choices.
export const FRIEND_NPC_CANON={
 Luke:{
  path:"Tactician",
  finalTeam:["Arcanine-Hisui","Venusaur","Kyurem-Black","Great Tusk","Kilowattrel","Blastoise"],
  rosterPlan:[["Growlithe-Hisui","Arcanine-Hisui"],["Bulbasaur","Ivysaur","Venusaur"],["Kyurem-Black"],["Great Tusk"],["Wattrel","Kilowattrel"],["Squirtle","Wartortle","Blastoise"]],
  additionalSpecializations:{7:"grass",18:"dragon"},
  identity:"adaptive bulky pressure; Arcanine ace; attrition and tactical control"
 },
 Mattew:{
  path:"Poké Mentor",
  finalTeam:["Jolteon","Infernape","Gardevoir","Swampert","Corviknight","Zacian-Crowned"],
  rosterPlan:[["Eevee","Jolteon"],["Chimchar","Monferno","Infernape"],["Ralts","Kirlia","Gardevoir"],["Mudkip","Marshtomp","Swampert"],["Rookidee","Corvisquire","Corviknight"],["Zacian-Crowned"]],
  additionalSpecializations:{7:"steel",18:"fighting"},
  identity:"technical training, optimization and direct competitive execution"
 },
 Daniel:{
  path:"Pokémon Collector",
  finalTeam:["Gengar","Machamp","Mewtwo","Charizard","Aggron","Poliwrath"],
  rosterPlan:[["Gastly","Haunter","Gengar"],["Machop","Machoke","Machamp"],["Mewtwo"],["Charmander","Charmeleon","Charizard"],["Aron","Lairon","Aggron"],["Poliwag","Poliwhirl","Poliwrath"]],
  additionalSpecializations:{7:"psychic",18:"fighting"},
  identity:"analysis, information and broad matchup knowledge"
 },
 Edward:{
  path:"Ace Trainer",
  finalTeam:["Feraligatr","Lapras","Jolteon","Houndoom","Lugia","Tyranitar"],
  rosterPlan:[["Totodile","Croconaw","Feraligatr"],["Lapras"],["Eevee","Jolteon"],["Houndour","Houndoom"],["Lugia"],["Larvitar","Pupitar","Tyranitar"]],
  additionalSpecializations:{7:"dark",18:"ice"},
  identity:"physical pressure and battle-first execution around Feraligatr"
 },
 Fab:{
  path:"Commander",
  finalTeam:["Weezing","Rayquaza","Electivire","Skarmory","Sceptile","Alakazam"],
  rosterPlan:[["Koffing","Weezing"],["Rayquaza"],["Elekid","Electabuzz","Electivire"],["Skarmory"],["Treecko","Grovyle","Sceptile"],["Abra","Kadabra","Alakazam"]],
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
