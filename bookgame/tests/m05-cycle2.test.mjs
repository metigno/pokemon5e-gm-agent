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
import { createPersistentNpc } from "../src/engine/npc-state.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const eventsDir=fileURLToPath(new URL("../content/events/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-06T08:00:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}
function legal(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="B";s.competition.rankOrder=4;s.player.trainerLevel=13;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m03_unlocked:true,m3_complete:true,m04_unlocked:true,m4_active:true,m4_complete:true,m05_unlocked:true,m5_active:true,
    altacima_discovered:true,m5_weather_decisions_complete:true,m5_fulgore_departure_ready:true,m5_fulgore_route_plan:"direct",
    lance_met:true,archie_met:true,friend_beat_04_complete:true,upper_regional_result:"skipped",smuggling_state:"resolved_without_player",
    a5_trace_available:true,a5_interregional_available:true,a5_five_cross_available:true
  });
  s.world.locationId="alt_town";
  return s;
}
function addFriend(s,id,locationId="alt_town"){
  const npc=createPersistentNpc({id,name:id,relationshipScore:0,state:{}});
  npc.schedule={id:"m5_test",locationId,availability:"available",activity:"reunion",startsAtMinutes:null,endsAtMinutes:null,present:true};
  s.npcs[id]=npc;
  return s;
}

test("M5_05-M5_09 lock exactly 82 logical nodes and 183 meaningful choices",async()=>{
  const {bundle}=await makeEngine();
  const ids=["m05-fulgore-ascent","m05-ancient-trace","m05-interregional-license","m05-five-cross-again","m05-friend-beat-05"];
  const nodes=ids.reduce((n,id)=>n+Object.keys(bundle.scenes[id].nodes).length,0);
  const choices=ids.reduce((n,id)=>n+Object.values(bundle.scenes[id].nodes).reduce((s,node)=>s+(node.choices?.length??0),0),0);
  assert.equal(nodes,82);
  assert.equal(choices,183);
});

test("M5 cycle-two canonical event windows compile",async()=>{
  const {bundle}=await makeEngine();
  const ids=new Set(bundle.worldEvents.map(e=>e.id));
  for(const id of ["A5_INTERREGIONAL","A5_TRACE","A5_FIVE_CROSS","M5_FRIEND_BEAT_SELECT"])assert.ok(ids.has(id));
});

test("Fulgore ecology compiles from canonical fauna",async()=>{
  const {bundle}=await makeEngine();
  const z=bundle.ecology.zones["FUL-PLATEAU"];
  assert.ok(z);
  const ids=new Set(z.species.map(x=>x.id));
  for(const id of ["riolu","geodude","machop"])assert.ok(ids.has(id));
});

test("M5_05 capturable Fulgore fauna exposes a real Pokémon 5e combat handoff",async()=>{
  const {engine,bundle}=await makeEngine();
  const scene=bundle.scenes["m05-fulgore-ascent"];
  for(const id of ["riolu","geodude","machop"])assert.ok(scene.nodes[`fauna_${id}`].choices.some(c=>c.id===`${id}_engage`),id);
  let s=legal();s.story.sceneId="m05-fulgore-ascent";s.story.nodeId="fauna_riolu";s.world.locationId="ful_plateau";
  s=await engine.choose(s,"riolu_engage");
  assert.equal(s.pending.type,"pokemon5e_combat");
  assert.equal(s.pending.opponent.species,"Riolu");
  assert.equal(s.pending.opponent.level,11);
  assert.equal(s.pending.opponentRegistered,false);
  assert.equal(s.pending.returnNodes.captured,"wild_captured");
});

test("M5_05 requires a real weather departure plan",async()=>{
  const {engine}=await makeEngine();const s=legal();delete s.world.flags.m5_fulgore_departure_ready;s.story.sceneId="m05-fulgore-ascent";s.story.nodeId="ascent_gate";
  await assert.rejects(()=>engine.present(s),/Scene conditions/);
});

test("M5_05 does not mark Fulgore visited before actual arrival",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.sceneId="m05-fulgore-ascent";s.story.nodeId="ascent_gate";
  s=await engine.choose(s,"gate_direct");
  assert.equal(s.world.flags.fulgore_visited,undefined);
  s.story.nodeId="plateau_arrival";
  s=await engine.choose(s,"arrival_complete");
  assert.equal(s.world.flags.fulgore_visited,true);
  assert.equal(s.world.flags.m5_fulgore_ascent_complete,true);
});

test("M5_06 unresolved trace creates a persistent mystery layer without changing roster",async()=>{
  const {engine}=await makeEngine();let s=legal();s.world.flags.fulgore_visited=true;s.story.sceneId="m05-ancient-trace";s.story.nodeId="trace_entry";
  s.player.roster=[{id:"a",species:"Growlithe"}];const roster=structuredClone(s.player.roster);
  s=await engine.choose(s,"trace_leave");s=await engine.choose(s,"unresolved_layer");s=await engine.choose(s,"layer_complete");
  assert.equal(s.world.flags.ancient_mystery_layer_1,"noticed_not_investigated");
  assert.equal(s.world.flags.m5_ancient_trace_complete,true);
  assert.deepEqual(s.player.roster,roster);
});

test("M5_06 strong trace still records only an unexplained layer",async()=>{
  const {engine}=await makeEngine();let s=legal();s.world.flags.fulgore_visited=true;s.story.sceneId="m05-ancient-trace";s.story.nodeId="strong_trace";
  s=await engine.choose(s,"strong_layer");assert.equal(s.world.flags.ancient_mystery_layer_1,"convergent_ancient_trace");
  assert.equal(s.world.flags.legendary_captured,undefined);
});

test("M5_07 registration is separate from the B to A Promotion Trial",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.sceneId="m05-interregional-license";s.story.nodeId="license_entry";
  s=await engine.choose(s,"entry_eligibility");s=await engine.choose(s,"eligible_register");s=await engine.choose(s,"register_now");
  assert.equal(s.world.flags.interregional_registration_complete,true);
  assert.equal(s.competition.rank,"B");
  assert.equal(s.competition.trials.RANK_B_TO_A.available,true);
  assert.equal(s.competition.trials.RANK_B_TO_A.registered,false);
  assert.equal(s.competition.trials.RANK_B_TO_A.completed,false);
});

test("M5_07 official assessment uses a fixed E5 roster",async()=>{
  const {bundle}=await makeEngine();const ch=bundle.scenes["m05-interregional-license"].nodes.assessment_handoff.choices[0];
  assert.equal(ch.combat.competition.matchId,"A5_INTERREGIONAL_ASSESSMENT");
  assert.equal(ch.combat.competition.officialRosterSize,3);
  assert.equal(ch.combat.opponent.level,11);
  assert.equal(ch.combat.opponentBench.length,2);
});

test("M5_07 a real assessment loss can still issue the license without changing Rank",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.sceneId="m05-interregional-license";s.story.nodeId="assessment_loss";
  s=await engine.choose(s,"loss_record");s=await engine.choose(s,"result_issue");s=await engine.choose(s,"issue_license");
  assert.equal(s.world.flags.interregional_assessment_result,"loss");
  assert.equal(s.world.flags.interregional_license,true);
  assert.equal(s.competition.rank,"B");
});

test("M5_08 hides physical friends who are not actually present",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.sceneId="m05-five-cross-again";s.story.nodeId="presence_board";
  const v=await engine.present(s);
  for(const id of ["presence_luke","presence_mattew","presence_daniel","presence_edward","presence_fab"])assert.equal(v.choices.some(c=>c.id===id),false);
  assert.ok(v.choices.some(c=>c.id==="presence_remote"));
});

test("M5_08 exposes a real present friend without teleporting the others",async()=>{
  const {engine}=await makeEngine();let s=addFriend(legal(),"Mattew");s.story.sceneId="m05-five-cross-again";s.story.nodeId="presence_board";
  const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="presence_mattew"));assert.equal(v.choices.some(c=>c.id==="presence_daniel"),false);
});

test("M5_08 closing the common reunion activates the schedule-aware Friend Beat selector",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.sceneId="m05-five-cross-again";s.story.nodeId="schedule_split";
  s=await engine.choose(s,"schedule_personal");
  assert.equal(s.world.flags.five_cross_complete,true);
  assert.equal(s.world.flags.friend_beat_05_available,true);
  assert.equal(s.world.flags.friend_beat_05_friend_id,"Mattew");
  assert.equal(s.world.flags.friend_beat_05_contact_mode,"remote");
});

test("M5_09 remote Friend Beat persists friend, type and relationship result",async()=>{
  const {engine}=await makeEngine();let s=addFriend(legal(),"Mattew","fer_city");
  Object.assign(s.world.flags,{five_cross_complete:true,friend_beat_05_available:true,friend_beat_05_friend_id:"Mattew",friend_beat_05_contact_mode:"remote"});
  s.story.sceneId="m05-friend-beat-05";s.story.nodeId="friend_call";
  s=await engine.choose(s,"dispatch_mattew");s=await engine.choose(s,"mattew_remote");const before=s.npcs.Mattew.relationship.score;
  s=await engine.choose(s,"mattew_remote_deep");s=await engine.choose(s,"mattew_deep_close");s=await engine.choose(s,"close_friend_beat_05");
  assert.equal(s.world.flags.friend_beat_05_complete,true);
  assert.equal(s.world.flags.friend_beat_05_friend_id,"Mattew");
  assert.equal(s.world.flags.friend_beat_05_type,"remote");
  assert.ok(s.npcs.Mattew.relationship.score>before);
});

test("M5 cycle-two state survives save/reload",async()=>{
  let dir;try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m5c2-"));const store=new SaveStore(dir);const {engine}=await makeEngine();
    let s=legal();s.world.flags.fulgore_visited=true;s.story.sceneId="m05-ancient-trace";s.story.nodeId="trace_entry";
    s=await engine.choose(s,"trace_leave");s=await engine.choose(s,"unresolved_layer");s=await engine.choose(s,"layer_complete");
    s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.ancient_mystery_layer_1,"noticed_not_investigated");
  }finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
