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
import { SequenceDice } from "../src/engine/dice.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-05T19:55:00.000Z";

async function makeEngine(dice=new SequenceDice([1])){
  const bundle=await compileStory({scenesDir,modulesDir,ecologyOptions});
  const scenes={
    async load(id){const s=bundle.scenes[id]; if(!s) throw new Error("missing scene "+id); return structuredClone(s);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,dice,now:fixedNow}),bundle};
}

function outcomeState(flags={},rank="E"){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank=rank; s.competition.rankOrder=rank==="D"?2:1;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.world.flags.a2_network_outcome_available=true;
  Object.assign(s.world.flags,flags);
  s.world.locationId="borgo_salice";
  s.story.sceneId="m02-network-outcome"; s.story.nodeId="network_outcome_review";
  return s;
}

async function visible(flags={},rank="E"){
  const {engine}=await makeEngine();
  const view=await engine.present(outcomeState(flags,rank));
  return view.choices.map(c=>c.id).filter(id=>id.startsWith("enter_"));
}

test("M2_11 keeps 15 nodes / 39 choices while repairing classification",async()=>{
  const {bundle}=await makeEngine();
  const scene=bundle.scenes["m02-network-outcome"];
  assert.equal(Object.keys(scene.nodes).length,15);
  assert.equal(Object.values(scene.nodes).reduce((n,x)=>n+(x.choices?.length||0),0),39);
});

test("M2_11 outcome review is legal at Rank E and Rank D",async()=>{
  const {engine}=await makeEngine();
  assert.ok(await engine.present(outcomeState({poaching_network_state:"avoided"},"E")));
  assert.ok(await engine.present(outcomeState({poaching_network_state:"avoided"},"D")));
});

test("resolved requires real intervention plus full Ranger report",async()=>{
  assert.deepEqual(await visible({poaching_network_state:"intervened",crisis_ranger_alerted:true,crisis_ranger_full_report:true}),["enter_resolved"]);
});

test("intervened without full report is partial only",async()=>{
  assert.deepEqual(await visible({poaching_network_state:"intervened",crisis_ranger_alerted:true}),["enter_partial"]);
});

test("investigating is partial rather than resolved",async()=>{
  assert.deepEqual(await visible({poaching_network_state:"investigating"}),["enter_partial"]);
});

test("Ranger thread alone is real incomplete progress and classifies partial",async()=>{
  assert.deepEqual(await visible({ranger_thread_opened:true}),["enter_partial"]);
});

test("formal capture report alone is real incomplete progress and classifies partial",async()=>{
  assert.deepEqual(await visible({capture_report_given:true}),["enter_partial"]);
});

test("crisis evidence alone is real incomplete progress and classifies partial",async()=>{
  assert.deepEqual(await visible({crisis_evidence_gathered:true}),["enter_partial"]);
});

test("explicit ignored crisis with no engagement classifies escalated",async()=>{
  assert.deepEqual(await visible({local_problem_ignored:true}),["enter_escalated"]);
});

test("real network_unchecked crisis with no engagement classifies escalated",async()=>{
  assert.deepEqual(await visible({poaching_network_state:"avoided",crisis_escalation_type:"network_unchecked"}),["enter_escalated"]);
});

test("silent_spread with no engagement classifies escalated",async()=>{
  assert.deepEqual(await visible({crisis_escalation_type:"silent_spread"}),["enter_escalated"]);
});

test("engagement wins over escalation and remains partial",async()=>{
  assert.deepEqual(await visible({local_problem_ignored:true,poaching_network_state:"intervened",crisis_ranger_alerted:true}),["enter_partial"]);
});

test("avoided without any canonical worsening signal classifies ignored, not escalated",async()=>{
  assert.deepEqual(await visible({poaching_network_state:"avoided"}),["enter_ignored"]);
});

test("no engagement and no worsening signal classifies ignored without fabricating escalation",async()=>{
  assert.deepEqual(await visible({}),["enter_ignored"]);
});

for(const [choice,expected,flags] of [
  ["enter_resolved","resolved",{poaching_network_state:"intervened",crisis_ranger_alerted:true,crisis_ranger_full_report:true}],
  ["enter_partial","partial",{ranger_thread_opened:true}],
  ["enter_escalated","escalated",{crisis_escalation_type:"network_unchecked"}],
  ["enter_ignored","ignored",{}]
]){
  test(choice+" writes exactly final state "+expected,async()=>{
    const {engine}=await makeEngine();
    let s=outcomeState(flags);
    s=await engine.choose(s,choice);
    assert.equal(s.world.flags.poaching_network_state,expected);
  });
}

test("A2_NETWORK_OUTCOME opens at Rank D even if player never started the local problem",async()=>{
  const {engine}=await makeEngine();
  let s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="D"; s.competition.rankOrder=2;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.world.locationId="borgo_salice";
  s.story.sceneId="m02-borgo-salice"; s.story.nodeId="borough_hub";
  s=await engine.choose(s,"sala_verde");
  assert.equal(s.events.A2_NETWORK_OUTCOME?.status,"resolved");
  assert.equal(s.world.flags.a2_network_outcome_available,true);
});

test("A2_NETWORK_OUTCOME still opens after crisis completion",async()=>{
  const {engine}=await makeEngine();
  let s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.world.flags.crisis_moves_complete=true;
  s.world.locationId="borgo_salice";
  s.story.sceneId="m02-borgo-salice"; s.story.nodeId="borough_hub";
  s=await engine.choose(s,"sala_verde");
  assert.equal(s.world.flags.a2_network_outcome_available,true);
});

test("A2_NETWORK_OUTCOME opens at day 25 without inventing intervention",async()=>{
  const {engine}=await makeEngine();
  let s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.world.day=25; s.world.elapsedMinutes=25*24*60;
  s.world.locationId="borgo_salice";
  s.story.sceneId="m02-borgo-salice"; s.story.nodeId="borough_hub";
  s=await engine.choose(s,"sala_verde");
  assert.equal(s.world.flags.a2_network_outcome_available,true);
  assert.equal(s.world.flags.poaching_network_state,undefined);
});

test("after final close M2_11 is idempotent and cannot reclassify",async()=>{
  const {engine}=await makeEngine();
  let s=outcomeState({ranger_thread_opened:true});
  s=await engine.choose(s,"enter_partial");
  s=await engine.choose(s,"acknowledge_partial");
  s=await engine.choose(s,"close_to_outro_partial");
  s=await engine.choose(s,"back_to_borgo_outcome");
  assert.equal(s.world.flags.poaching_network_state,"partial");
  assert.equal(s.world.flags.network_outcome_complete,true);
  s.story.sceneId="m02-network-outcome"; s.story.nodeId="network_outcome_review";
  await assert.rejects(()=>engine.present(s),/conditions are not satisfied/i);
});

test("final network outcome survives save/reload",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"m2-outcome-save-"));
  try{
    const {engine}=await makeEngine();
    const store=new SaveStore(dir);
    let s=outcomeState({crisis_escalation_type:"silent_spread"}); s.slot="m2-outcome";
    s=await engine.choose(s,"enter_escalated");
    s=await engine.choose(s,"accept_escalated");
    s=await engine.choose(s,"close_to_outro_escalated");
    s=await engine.choose(s,"back_to_borgo_outcome");
    await store.save(s);
    const loaded=await store.load("m2-outcome");
    assert.equal(loaded.world.flags.poaching_network_state,"escalated");
    assert.equal(loaded.world.flags.network_outcome_complete,true);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
