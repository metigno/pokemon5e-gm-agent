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
import { setNpcSchedule } from "../src/engine/npc-state.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const eventsDir=fileURLToPath(new URL("../content/events/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-06T13:35:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function sixRoster(){
  return Array.from({length:6},(_,i)=>({
    id:"p"+i,
    speciesId:"test_"+i,
    name:"P"+i,
    level:20,
    hp:{current:20-i,max:20},
    statuses:i===1?["fatigued"]:[],
    abilityId:"test_ability",
    moveIds:["move_a","move_b"],
    pp:[5,4]
  }));
}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="S";
  s.competition.rankOrder=6;
  s.player.trainerLevel=18;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,
    m7_complete:true,m08_unlocked:true,world_qualified:true,m7_before_lights_complete:true,
    friend_beat_07_complete:true,friend_beat_07_friend_id:"Daniel",m7_qualifier_result_resolved:true,
    m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,m8_medical_control_complete:true,
    m8_world_registration_complete:true,m8_world_roster_registered:true,m8_world_village_arrived:true
  });
  s.world.locationId="world_village";
  return s;
}

async function withAstrid(engine,s){
  s.story.sceneId="m08-world-village";s.story.nodeId="village_commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m8_world_village_orientation_complete,true);
  assert.equal(s.world.flags.m8_astrid_available,true);
  assert.equal(s.npcs.AstridVahl.name,"Astrid Vahl");
  return s;
}

test("M8_05 living-world event registers Astrid with a real World Village schedule",async()=>{
  const {engine}=await makeEngine();
  let s=await withAstrid(engine,base());
  assert.equal(s.npcs.AstridVahl.schedule.locationId,"world_village");
  assert.equal(s.npcs.AstridVahl.schedule.present,true);
  assert.equal(s.npcs.AstridVahl.state.role,"reigning_world_champion_anchor");
  assert.equal(s.world.flags.astrid_met,undefined);
});

test("M8_05 first Astrid meeting is persistent and never grants draw state",async()=>{
  const {engine}=await makeEngine();
  let s=await withAstrid(engine,base());
  s.story.sceneId="m08-astrid-enters";s.story.nodeId="astrid_entry";
  s=await engine.choose(s,"astrid_introduce");
  assert.equal(s.world.flags.astrid_met,true);
  assert.equal(s.npcs.AstridVahl.state.introduced,true);
  assert.equal(s.world.flags.world_draw_complete,undefined);
  assert.equal(s.world.flags.player_group,undefined);
  s.story.sceneId="m08-astrid-enters";s.story.nodeId="astrid_entry";
  const view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="astrid_reengage"));
  assert.equal(view.choices.some(c=>c.id==="astrid_introduce"),false);
});

test("M8_06 selector prefers a real physical Village overlap when available",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  setNpcSchedule(s,{npcId:"Mattew",scheduleId:"m8_mattew_world_village",locationId:"world_village",availability:"available",activity:"world_preparation"});
  s=await withAstrid(engine,s);
  s.story.sceneId="m08-astrid-enters";s.story.nodeId="astrid_entry";
  s=await engine.choose(s,"astrid_introduce");
  assert.equal(s.world.flags.friend_beat_08_available,true);
  assert.equal(s.world.flags.friend_beat_08_friend_id,"Mattew");
  assert.equal(s.world.flags.friend_beat_08_contact_mode,"physical");
});

test("M8_06 selector falls back to remote contact without teleporting a friend",async()=>{
  const {engine}=await makeEngine();
  let s=await withAstrid(engine,base());
  s.story.sceneId="m08-astrid-enters";s.story.nodeId="astrid_entry";
  s=await engine.choose(s,"astrid_introduce");
  assert.equal(s.world.flags.friend_beat_08_friend_id,"Mattew");
  assert.equal(s.world.flags.friend_beat_08_contact_mode,"remote");
  assert.notEqual(s.npcs.Mattew.schedule?.locationId,"world_village");
});

test("M8_06 records Friend Beat without assigning qualification, seed or group",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{astrid_met:true,friend_beat_08_available:true,friend_beat_08_friend_id:"Mattew",friend_beat_08_contact_mode:"remote"});
  s.story.sceneId="m08-friend-beat-08";s.story.nodeId="result_record";
  s=await engine.choose(s,"record_complete");
  assert.equal(s.world.flags.friend_beat_08_complete,true);
  assert.equal(s.world.flags.world_draw_complete,undefined);
  assert.equal(s.world.flags.player_group,undefined);
});

test("M8_07 optional sparring hands authority to Pokémon 5e and is not an official World match",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{astrid_met:true,friend_beat_08_complete:true});
  s.story.sceneId="m08-training-hall";s.story.nodeId="spar_offer";
  s=await engine.choose(s,"spar_accept");
  assert.equal(s.pending.type,"pokemon5e_combat");
  assert.equal(s.pending.opponent.species,"Lucario");
  assert.equal(s.pending.opponent.level,18);
  assert.equal(s.pending.opponentRegistered,true);
  assert.equal(s.pending.competition,null);
  assert.equal(s.competition.activeMatch,null);
  assert.equal(s.pending.playerPokemon.rosterIndex,0);
});

test("M8_07 technical training consumes time but grants no stat or draw shortcut",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{astrid_met:true,friend_beat_08_complete:true});
  const abilities=structuredClone(s.player.abilities);
  const before=s.world.elapsedMinutes;
  s.story.sceneId="m08-training-hall";s.story.nodeId="technical_drill";
  s=await engine.choose(s,"drill_hour");
  assert.equal(s.world.elapsedMinutes-before,60);
  assert.deepEqual(s.player.abilities,abilities);
  assert.equal(s.world.flags.m8_training_focus,"technical_refinement");
  assert.equal(s.world.flags.world_draw_complete,undefined);
});

test("M8_08 player chooses media posture without changing Trainer stats",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{astrid_met:true,friend_beat_08_complete:true,m8_training_hall_complete:true});
  const abilities=structuredClone(s.player.abilities);
  s.story.sceneId="m08-media-day";s.story.nodeId="open_style";
  s=await engine.choose(s,"open_record");
  assert.equal(s.world.flags.m8_media_style,"open");
  assert.deepEqual(s.player.abilities,abilities);
  assert.equal(s.world.flags.world_draw_complete,undefined);
});

test("M8_09 opening ceremony completes without locking the field or assigning opponents",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{astrid_met:true,friend_beat_08_complete:true,m8_training_hall_complete:true,m8_media_day_complete:true});
  s.story.sceneId="m08-opening-ceremony";s.story.nodeId="ceremony_commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m8_opening_ceremony_complete,true);
  assert.equal(s.world.flags.world_draw_complete,undefined);
  assert.equal(s.world.flags.world_field_32_locked,undefined);
  assert.equal(s.world.flags.player_group,undefined);
});

test("M8 cycle2 save/reload preserves Anchor, Friend Beat and pre-draw state",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m8c2-"));
    const store=new SaveStore(dir);
    let s=base();
    s.npcs.AstridVahl={
      id:"AstridVahl",name:"Astrid Vahl",
      relationship:{score:2,qualitative:"Neutral"},
      schedule:{id:"m8_world_village_anchor",locationId:"world_village",availability:"available",activity:"world_preparation",startsAtMinutes:null,endsAtMinutes:null,present:true},
      state:{role:"reigning_world_champion_anchor",introduced:true}
    };
    Object.assign(s.world.flags,{
      m8_world_village_orientation_complete:true,m8_astrid_available:true,astrid_met:true,
      friend_beat_08_available:true,friend_beat_08_friend_id:"Mattew",friend_beat_08_contact_mode:"remote",
      friend_beat_08_type:"remote_world_contact",friend_beat_08_complete:true,
      m8_training_hall_complete:true,m8_media_style:"guarded",m8_media_day_complete:true,m8_opening_ceremony_complete:true
    });
    s.slot="slot1";await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.world_draw_complete,undefined);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
