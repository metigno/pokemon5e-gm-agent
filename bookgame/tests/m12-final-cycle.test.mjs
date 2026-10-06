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
const fixedNow=()=> "2026-10-06T22:00:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return new BookgameEngine({scenes,now:fixedNow});
}
function roster(){
  return ["eevee","gastly","totodile","koffing","houndour","shinx"].map((speciesId,index)=>({
    id:"p"+index,speciesId,name:speciesId,level:20,
    hp:{current:16-index,max:20},
    statuses:{nonVolatile:index===0?"burned":null,remainingRounds:null,flinchedTurns:0},
    abilityId:null,moveIds:[],pp:{tackle:Math.max(0,5-index)}
  }));
}
function base(route="world_champion"){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot="m12-final-"+route;
  s.player.trainerLevel=20;
  s.player.roster=roster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.world.locationId="meridiana_city";
  Object.assign(s.world.flags,{
    m12_unlocked:true,m12_active:true,m12_world_exit_resolved:true,m12_world_exit_branch_complete:true,
    m12_return_asteria_complete:true,m12_valedarsena_callbacks_complete:true,m12_bruma_callbacks_complete:true,
    m12_ferrox_callbacks_complete:true,m12_coast_callbacks_complete:true,m12_highlands_callbacks_complete:true,
    m12_interregional_callbacks_complete:true,m12_meridiana_callbacks_complete:true,m12_cycle1_complete:true,m12_cycle2_complete:true,
    m12_world_exit_route:route,
    friend_beat_11_friend_id:"Mattew",
    ancient_mystery_layer_1:"partial_unresolved_trace",
    ancient_mystery_layer_2:"second_layer_unresolved",
    m6_lighthouse_return_ready:true
  });
  if(route==="world_champion"){
    Object.assign(s.world.flags,{world_champion:true,world_eliminated:false,worlds_missed:false,current_world_champion:"Luke"});
    s.competition.world.currentWorldChampion={id:"c2060_01_luke",name:"Luke"};
  }else if(route==="world_eliminated"){
    Object.assign(s.world.flags,{world_champion:false,world_eliminated:true,worlds_missed:false,current_world_champion:"Daniel"});
    s.competition.world.currentWorldChampion={id:"c2060_03_daniel",name:"Daniel"};
  }else{
    Object.assign(s.world.flags,{world_champion:false,world_eliminated:false,worlds_missed:true,world_qualified:false});
  }
  s.quests.SQ_RESIDUE={id:"SQ_RESIDUE",status:"active",resolution:null,startedAtMinutes:10,deadlineAtMinutes:null,resolvedAtMinutes:null};
  return s;
}

async function closeFriendBeat(engine,state){
  let s=structuredClone(state);
  s.story.sceneId="m12-friend-beat-12";
  s.story.nodeId="selector";
  s=await engine.choose(s,"select_primary");
  assert.equal(s.world.flags.friend_beat_12_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_12_contact_mode,"remote");
  s.story.nodeId="primary_remote";
  s=await engine.choose(s,"open_group");
  s.story.nodeId="group_record";
  s=await engine.choose(s,"record_luke");
  assert.deepEqual(s.world.flags.friend_beat_12_friend_ids,["Mattew","Daniel","Edward","Fab"]);
  s.story.nodeId="commitment";
  s=await engine.choose(s,"commit_friend_beat");
  assert.equal(s.world.flags.friend_beat_12_complete,true);
  return s;
}

async function registerHooks(engine,state){
  let s=structuredClone(state);
  s.story.sceneId="m12-postgame-hooks";
  s.story.nodeId="hook_synthesis";
  s=await engine.choose(s,"register_policy");
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_hooks");
  return s;
}

async function finish(engine,state){
  let s=structuredClone(state);
  s.story.sceneId="m12-main-story-complete";
  s.story.nodeId="commit_guard";
  return engine.choose(s,"commit_final");
}

test("FRIEND_BEAT_12 guarantees a causal primary contact and records all other Four without teleporting them",async()=>{
  const engine=await makeEngine();
  let s=base();
  const beforeNpcs=structuredClone(s.npcs);
  s=await closeFriendBeat(engine,s);
  assert.equal(s.world.flags.friend_beat_12_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_12_primary_mode,"remote");
  assert.equal(s.world.flags.friend_beat_12_type,"mixed_group_closure");
  assert.equal(s.world.flags.friend_beat_12_result,"future_open");
  assert.deepEqual(s.world.flags.friend_beat_12_friend_ids,["Mattew","Daniel","Edward","Fab"]);
  for(const id of ["Mattew","Daniel","Edward","Fab"]){
    assert.notEqual(s.npcs[id].schedule?.locationId,"meridiana_city");
  }
});

test("FRIEND_BEAT_12 uses physical contact only when E4 schedule actually places that friend in Meridiana",async()=>{
  const engine=await makeEngine();
  let s=base();
  s.npcs.Daniel.schedule={id:"m12_test",locationId:"meridiana_city",availability:"available",activity:"postworld",startsAtMinutes:null,endsAtMinutes:null,present:true};
  s.story.sceneId="m12-friend-beat-12";
  s.story.nodeId="selector";
  s=await engine.choose(s,"select_primary");
  assert.equal(s.world.flags.friend_beat_12_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_12_contact_mode,"physical");
  s.story.nodeId="primary_physical";
  s=await engine.choose(s,"open_group");
  assert.equal(s.world.flags.friend_beat_12_primary_mode,"physical");
});

test("FRIEND_BEAT_12 selection is persistent and does not reroll on re-entry",async()=>{
  const engine=await makeEngine();
  let s=base();
  s.story.sceneId="m12-friend-beat-12";
  s.story.nodeId="selector";
  s=await engine.choose(s,"select_primary");
  const selected=s.world.flags.friend_beat_12_friend_id;
  s.story.nodeId="selector";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="select_primary"),false);
  assert.ok(view.choices.some(c=>c.id==="select_existing"));
  s=await engine.choose(s,"select_existing");
  assert.equal(s.world.flags.friend_beat_12_friend_id,selected);
});

test("M12_10 registers postgame policies without mutating lore, quests, roster or champion",async()=>{
  const engine=await makeEngine();
  let s=await closeFriendBeat(engine,base());
  const before={
    roster:structuredClone(s.player.roster),
    quests:structuredClone(s.quests),
    competition:structuredClone(s.competition),
    layer1:s.world.flags.ancient_mystery_layer_1,
    layer2:s.world.flags.ancient_mystery_layer_2,
    lighthouse:s.world.flags.m6_lighthouse_return_ready
  };
  s=await registerHooks(engine,s);
  assert.equal(s.world.flags.m12_postgame_hooks_complete,true);
  assert.equal(s.world.flags.postgame_hooks_registered,true);
  assert.equal(s.world.flags.postgame_legendary_policy,"preserve_existing_only");
  assert.equal(s.world.flags.postgame_ancient_mystery_policy,"preserve_known_layers");
  assert.deepEqual(s.player.roster,before.roster);
  assert.deepEqual(s.quests,before.quests);
  assert.deepEqual(s.competition,before.competition);
  assert.equal(s.world.flags.ancient_mystery_layer_1,before.layer1);
  assert.equal(s.world.flags.ancient_mystery_layer_2,before.layer2);
  assert.equal(s.world.flags.m6_lighthouse_return_ready,before.lighthouse);
});

test("M12_11 closes champion, eliminated and Worlds Missed routes without rewriting their competitive truth",async()=>{
  const engine=await makeEngine();
  for(const route of ["world_champion","world_eliminated","worlds_missed"]){
    let s=await closeFriendBeat(engine,base(route));
    s=await registerHooks(engine,s);
    const before={competition:structuredClone(s.competition),roster:structuredClone(s.player.roster),quests:structuredClone(s.quests),npcs:structuredClone(s.npcs),route:s.world.flags.m12_world_exit_route};
    s=await finish(engine,s);
    assert.equal(s.world.flags.main_story_complete,true);
    assert.equal(s.world.flags.postgame_free_roam,true);
    assert.equal(s.world.flags.free_roam,true);
    assert.equal(s.world.flags.m12_complete,true);
    assert.equal(s.world.flags.m12_main_story_complete,true);
    assert.equal(s.world.flags.m12_world_exit_route,before.route);
    assert.deepEqual(s.competition,before.competition);
    assert.deepEqual(s.player.roster,before.roster);
    assert.deepEqual(s.quests,before.quests);
    assert.deepEqual(s.npcs,before.npcs);
  }
});

test("M12 final commit is idempotent and postgame free roam remains interactive",async()=>{
  const engine=await makeEngine();
  let s=await closeFriendBeat(engine,base());
  s=await registerHooks(engine,s);
  s=await finish(engine,s);
  const snapshot=structuredClone(s);
  s.story.sceneId="m12-main-story-complete";
  s.story.nodeId="commit_guard";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="commit_final"),false);
  assert.ok(view.choices.some(c=>c.id==="commit_existing"));
  s=await engine.choose(s,"commit_existing");
  assert.deepEqual(s.competition,snapshot.competition);
  assert.deepEqual(s.player.roster,snapshot.player.roster);
  s.story.nodeId="free_roam";
  s=await engine.choose(s,"stay_free_roam");
  assert.equal(s.story.nodeId,"free_roam");
  assert.equal(s.world.flags.postgame_free_roam,true);
});

test("complete M12 state survives save/reload including friend list and writable postgame flags",async()=>{
  let dir;
  try{
    const engine=await makeEngine();
    let s=await closeFriendBeat(engine,base());
    s=await registerHooks(engine,s);
    s=await finish(engine,s);
    dir=await mkdtemp(path.join(os.tmpdir(),"m12-final-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load(s.slot);
    assert.equal(loaded.world.flags.main_story_complete,true);
    assert.equal(loaded.world.flags.postgame_free_roam,true);
    assert.equal(loaded.world.flags.m12_complete,true);
    assert.deepEqual(loaded.world.flags.friend_beat_12_friend_ids,["Mattew","Daniel","Edward","Fab"]);
    assert.deepEqual(loaded.player.roster,s.player.roster);
    assert.deepEqual(loaded.competition,s.competition);
    assert.deepEqual(loaded.quests,s.quests);
  }finally{
    if(dir) await rm(dir,{recursive:true,force:true});
  }
});
