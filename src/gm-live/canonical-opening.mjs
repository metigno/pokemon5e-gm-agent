import { getStartingBuild } from '../bridge/motor-to-poke5e.mjs';
import { GmSession } from './session.mjs';

/**
 * Canonical opening character builder. The trainer begins at level 1;
 * the starter Pokemon begins at level 5. No combat stats are invented.
 */
export function openingState(protagonist) {
 const build = getStartingBuild(protagonist);
 return {
  character: { name:protagonist, trainerLevel:1, abilities:build.abilities, skills:build.skills },
  team: [{ species:build.starter.species, form:build.starter.form, level:build.starter.level,
    status:'starter-pending-intro', stats:null, moves:[], pp:null }],
  world: {day:1,time:'morning',location:'Valedarsena',flags:{introFive:'pending'}},
  npcStates: Object.fromEntries(['Luke','Edward','Fab','Daniel','Mattew']
   .filter(name=>name!==protagonist).map(name=>[name,{role:'friend',trainerLevel:1,
    starter:getStartingBuild(name).starter,progression:'independent'}]))
 };
}
export async function startCanonicalCampaign(root,protagonist,campaignId) {
 const gm = new GmSession(root);
 const game = await gm.start(protagonist,campaignId);
 return gm.record(game.campaignId,game.revision,{
  playerAction:'Begin canonical INTRO_FIVE campaign',
  narration:'Campaign created at Valedarsena. Intro scene awaits player choices.',
  statePatch:openingState(protagonist)
 });
}
