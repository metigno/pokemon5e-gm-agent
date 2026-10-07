import { acquireCareerPokemon } from "./npc-roster-progression.mjs";
import { progressCanonicalFriendNpc } from "./npc-progression.mjs";
import { moduleTrainerLevelBand } from "./module-progression-guard.mjs";

export const FRIEND_CAREER_MODULE_MILESTONES={
 M01:{trainerLevel:2,acquireSlots:[]},
 M02:{trainerLevel:4,acquireSlots:[2]},
 M03:{trainerLevel:7,acquireSlots:[]},
 M04:{trainerLevel:10,acquireSlots:[3]},
 M05:{trainerLevel:13,acquireSlots:[4]},
 M06:{trainerLevel:16,acquireSlots:[]},
 M07:{trainerLevel:18,acquireSlots:[5]},
 M08:{trainerLevel:18,acquireSlots:[]},
 M09:{trainerLevel:19,acquireSlots:[6]},
 M10:{trainerLevel:19,acquireSlots:[]},
 M11:{trainerLevel:20,acquireSlots:[]},
 M12:{trainerLevel:20,acquireSlots:[]}
};

export function applyFriendCareerModuleMilestone(state,moduleId,{pokemonLevels={},eventPrefix="NPC_CAREER"}={}){
 const milestone=FRIEND_CAREER_MODULE_MILESTONES[moduleId];
 if(!milestone) throw new Error("Unknown career module milestone: "+moduleId);
 const band=moduleTrainerLevelBand(moduleId);
 if(milestone.trainerLevel<band.min||milestone.trainerLevel>band.max) throw new RangeError(`NPC career level ${milestone.trainerLevel} is outside ${moduleId} canonical band ${band.min}-${band.max}`);
 state.events.npcCareerMilestones ??={};
 const key=moduleId;
 if(state.events.npcCareerMilestones[key]) return state;
 for(const [name,npc] of Object.entries(state.npcs)){
  if(!npc?.canonicalCareer) continue;
  const progressed=progressCanonicalFriendNpc(npc,milestone.trainerLevel);
  state.npcs[name]=progressed;
  for(const slot of milestone.acquireSlots){
   const level=pokemonLevels[name]?.[slot];
   if(!Number.isInteger(level)) continue; // acquisition waits until resolver supplies a legal level
   acquireCareerPokemon(progressed,slot,{pokemonLevel:level,storyEventId:`${eventPrefix}:${moduleId}:${name}:S${slot}`});
  }
 }
 state.events.npcCareerMilestones[key]={applied:true,moduleId};
 return state;
}
