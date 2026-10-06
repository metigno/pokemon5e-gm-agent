import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const eventsDir=fileURLToPath(new URL("../content/events/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-06T21:00:00.000Z";

async function makeEngine(){
 const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
 const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};
 return new BookgameEngine({scenes,now:fixedNow});
}
function base(){
 const s=createNewGameState({protagonist:"Luke",now:fixedNow});
 s.slot="m12-cycle2";
 s.world.locationId="mar_city";
 Object.assign(s.world.flags,{
  m12_unlocked:true,m12_world_exit_branch_complete:true,m12_return_asteria_complete:true,
  m12_valedarsena_callbacks_complete:true,m12_bruma_callbacks_complete:true,m12_ferrox_callbacks_complete:true,m12_cycle1_complete:true,
  smuggling_state:"route_documented",
  m5_high_altitude_event_complete:true,m5_high_altitude_event_result:"supported_response",
  ancient_mystery_layer_1:"partial_unresolved_trace",
  continental_result:"finalist",m6_masters_circuit_visited:true,m6_masters_result:"loss",
  m7_sponsor_path:"local_partner",m7_qualifier_result:"qualified",world_qualified:true,worlds_missed:false
 });
 return s;
}
test("M12_05 Coast callback preserves the actual M4 smuggling outcome",async()=>{
 const engine=await makeEngine(); let s=base();
 s.story.sceneId="m12-coast-callbacks"; s.story.nodeId="callback_synthesis";
 const prior=s.world.flags.smuggling_state;
 s=await engine.choose(s,"class_documented");
 assert.equal(s.world.flags.smuggling_state,prior);
 assert.equal(s.world.flags.m12_coast_callback_state,"route_documented");
 assert.equal(s.world.flags.m12_coast_callbacks_complete,true);
 assert.equal(s.world.locationId,"alt_town");
});
test("M12_06 Highlands records both ancient-mystery knowledge and the real altitude result",async()=>{
 const engine=await makeEngine(); let s=base(); s.world.flags.m12_coast_callbacks_complete=true;
 const mystery=s.world.flags.ancient_mystery_layer_1, altitude=s.world.flags.m5_high_altitude_event_result;
 s.story.sceneId="m12-highlands-callbacks"; s.story.nodeId="mystery_synthesis";
 s=await engine.choose(s,"mystery_partial");
 assert.equal(s.world.flags.m12_highlands_mystery_context,"partial_unresolved_trace");
 s=await engine.choose(s,"event_supported");
 assert.equal(s.world.flags.ancient_mystery_layer_1,mystery);
 assert.equal(s.world.flags.m5_high_altitude_event_result,altitude);
 assert.equal(s.world.flags.m12_highlands_callback_state,"supported_response");
 assert.equal(s.world.flags.m12_highlands_callbacks_complete,true);
});
test("M12_07 Interregional preserves Continental and Masters results independently",async()=>{
 const engine=await makeEngine(); let s=base(); s.world.flags.m12_highlands_callbacks_complete=true;
 const continental=s.world.flags.continental_result, masters=s.world.flags.m6_masters_result;
 s.story.sceneId="m12-interregional-callbacks"; s.story.nodeId="continental_synthesis";
 s=await engine.choose(s,"continental_finalist");
 assert.equal(s.world.flags.m12_interregional_continental_context,"finalist");
 s=await engine.choose(s,"masters_loss");
 assert.equal(s.world.flags.continental_result,continental);
 assert.equal(s.world.flags.m6_masters_result,masters);
 assert.equal(s.world.flags.m12_interregional_callback_state,"masters_loss");
 assert.equal(s.world.flags.m12_interregional_callbacks_complete,true);
});
test("M12_08 distinguishes direct qualification, Last Chance and Worlds Missed without rewriting M7",async()=>{
 const engine=await makeEngine();

 let direct=base(); direct.world.flags.m12_interregional_callbacks_complete=true;
 direct.story.sceneId="m12-meridiana-callbacks"; direct.story.nodeId="sponsor_synthesis";
 direct=await engine.choose(direct,"sponsor_local");
 direct=await engine.choose(direct,"outcome_direct");
 assert.equal(direct.world.flags.m12_meridiana_callback_state,"qualified_direct");
 assert.equal(direct.world.flags.world_qualified,true);

 let last=base(); Object.assign(last.world.flags,{m12_interregional_callbacks_complete:true,m7_qualifier_result:"eliminated_qualifying_match",m7_last_chance_result:"qualified",world_qualified:true});
 last.story.sceneId="m12-meridiana-callbacks"; last.story.nodeId="outcome_synthesis";
 last=await engine.choose(last,"outcome_last_chance");
 assert.equal(last.world.flags.m12_meridiana_callback_state,"qualified_last_chance");
 assert.equal(last.world.flags.m7_last_chance_result,"qualified");

 let missed=base(); Object.assign(missed.world.flags,{m12_interregional_callbacks_complete:true,m7_qualifier_result:"eliminated_round1",m7_last_chance_result:"lost",world_qualified:false,worlds_missed:true});
 missed.story.sceneId="m12-meridiana-callbacks"; missed.story.nodeId="outcome_synthesis";
 missed=await engine.choose(missed,"outcome_missed");
 assert.equal(missed.world.flags.m12_meridiana_callback_state,"worlds_missed");
 assert.equal(missed.world.flags.worlds_missed,true);
 assert.equal(missed.world.flags.m12_cycle2_complete,true);
 assert.notEqual(missed.world.flags.main_story_complete,true);
});
test("M12 Cycle 2 survives save/reload without altering prior module outcomes",async()=>{
 let dir;
 try{
  const engine=await makeEngine(); let s=base();
  Object.assign(s.world.flags,{m12_coast_callbacks_complete:true,m12_highlands_callbacks_complete:true,m12_interregional_callbacks_complete:true});
  s.story.sceneId="m12-meridiana-callbacks"; s.story.nodeId="outcome_synthesis";
  s=await engine.choose(s,"outcome_direct");
  const prior={smuggling:s.world.flags.smuggling_state,mystery:s.world.flags.ancient_mystery_layer_1,altitude:s.world.flags.m5_high_altitude_event_result,continental:s.world.flags.continental_result,masters:s.world.flags.m6_masters_result,qualifier:s.world.flags.m7_qualifier_result};
  dir=await mkdtemp(path.join(os.tmpdir(),"m12c2-"));
  const store=new SaveStore(dir); await store.save(s); const loaded=await store.load(s.slot);
  assert.equal(loaded.world.flags.m12_cycle2_complete,true);
  assert.deepEqual({smuggling:loaded.world.flags.smuggling_state,mystery:loaded.world.flags.ancient_mystery_layer_1,altitude:loaded.world.flags.m5_high_altitude_event_result,continental:loaded.world.flags.continental_result,masters:loaded.world.flags.m6_masters_result,qualifier:loaded.world.flags.m7_qualifier_result},prior);
 }finally{if(dir) await rm(dir,{recursive:true,force:true});}
});
