export function createNpcPokemonIdentity({ownerId,slot,line,starter=false}){
 if(!Array.isArray(line)||line.length===0) throw new Error("Pokemon career line is required");
 return {
  id:ownerId.toLowerCase()+"-career-"+slot,
  ownerId,slot,starter,
  species:line[0],
  evolutionLine:structuredClone(line),
  evolutionIndex:0,
  pokemonLevel:starter?5:null,
  acquired:starter,
  acquiredAt:null,
  evolutionHistory:[],
  specialUnlocks:[],
  status:"active"
 };
}

export function initializeFriendCareerRoster(npc){
 const plan=npc.canonicalCareer?.rosterPlan;
 if(!plan) throw new Error("Canonical friend roster plan missing");
 return plan.map((line,i)=>createNpcPokemonIdentity({ownerId:npc.id,slot:i+1,line,starter:i===0}));
}

export function acquireCareerPokemon(npc,slot,{pokemonLevel,storyEventId}={}){
 const p=npc.rosterCareer?.find(x=>x.slot===slot);
 if(!p) throw new Error("Unknown career roster slot: "+slot);
 if(p.acquired) return p;
 if(!Number.isInteger(pokemonLevel)||pokemonLevel<1) throw new Error("Acquisition requires a legal Pokemon level");
 if(!storyEventId) throw new Error("Acquisition requires a persistent story event");
 p.acquired=true;p.pokemonLevel=pokemonLevel;p.acquiredAt=storyEventId;return p;
}

export function evolveCareerPokemon(npc,slot,{toSpecies,pokemonLevel,requirementsSatisfied=false,storyEventId}={}){
 const p=npc.rosterCareer?.find(x=>x.slot===slot);
 if(!p||!p.acquired) throw new Error("Pokemon must be acquired before evolution");
 const next=p.evolutionLine[p.evolutionIndex+1];
 if(next!==toSpecies) throw new Error("Evolution must follow canonical career line");
 if(!requirementsSatisfied) throw new Error("Pokemon 5e evolution requirements are not satisfied");
 if(!Number.isInteger(pokemonLevel)||pokemonLevel<p.pokemonLevel) throw new Error("Pokemon level cannot decrease");
 p.evolutionHistory.push({from:p.species,to:toSpecies,level:pokemonLevel,storyEventId:storyEventId??null});
 p.species=toSpecies;p.evolutionIndex+=1;p.pokemonLevel=pokemonLevel;return p;
}
