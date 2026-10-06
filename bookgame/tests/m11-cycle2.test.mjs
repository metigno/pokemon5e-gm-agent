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
const fixedNow=()=> "2026-10-06T19:00:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}
function p(id,name){return {id,name};}
function sixRoster(){
  const species=["eevee","gastly","totodile","koffing","houndour","shinx"];
  return species.map((speciesId,index)=>({
    id:"player_"+index,speciesId,name:speciesId,level:20,
    hp:{current:20-index,max:20},
    statuses:{nonVolatile:null,remainingRounds:null,flinchedTurns:0},
    abilityId:null,moveIds:[],pp:{}
  }));
}
function base({playerFinalist=true}={}){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot=playerFinalist?"slot-m11-finalist":"slot-m11-sf-loss";
  s.player.trainerLevel=20;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.world.locationId="world_knockout_hall";
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,m7_complete:true,m8_complete:true,m9_complete:true,m10_complete:true,
    m11_unlocked:true,m11_active:true,m11_final_four_lock_complete:true,m11_rei_thread_complete:true,m11_sf_prep_complete:true,m11_world_sf_complete:true,
    m11_other_sf_complete:true,m11_cycle1_complete:true,world_qualified:true,world_group_advanced:true,world_top16_locked:true,world_group_stage_resolved:true,
    world_qf_won:true,world_qf_resolved:true,world_top4_locked:true,world_sf_resolved:true,world_sf_round_resolved:true,world_finalists_locked:true,
    world_sf_won:playerFinalist,world_eliminated:!playerFinalist,world_finalist:playerFinalist,friend_beat_10_friend_id:"Mattew"
  });
  const world=s.competition.world;
  world.drawComplete=true;
  world.fieldLocked=true;
  world.drawSeed=playerFinalist?"m11-finalist-seed":"m11-sf-loss-seed";
  world.playerOpponents=[p("g1","Group One"),p("g2","Group Two"),p("g3","Group Three")];
  world.field=[p("c2060_01_luke","Luke"),p("c2060_03_daniel","Daniel"),p("c2060_31_rei","Rei"),p("c2060_17_cynthia","Cynthia"),p("c2060_02_mattew","Mattew"),p("c2060_04_edward","Edward"),p("c2060_05_fab","Fab")];
  world.seedOrder=structuredClone(world.field);
  world.qualifications={
    c2060_03_daniel:{participantId:"c2060_03_daniel",name:"Daniel",qualified:true,source:"npc_actual"},
    c2060_02_mattew:{participantId:"c2060_02_mattew",name:"Mattew",qualified:true,source:"npc_actual"},
    c2060_04_edward:{participantId:"c2060_04_edward",name:"Edward",qualified:true,source:"npc_actual"},
    c2060_05_fab:{participantId:"c2060_05_fab",name:"Fab",qualified:true,source:"npc_actual"}
  };
  world.top16Locked=true;
  world.top16=Array.from({length:16},(_,i)=>({participantId:"top16_"+i,name:i===0?"Luke":i===1?"Daniel":"Top16 "+i,group:String.fromCharCode(65+Math.floor(i/2)),groupPosition:i%2+1,points:9-(i%2)*3}));
  world.groupStage.opened=true;
  world.groupStage.resolved=true;
  world.groupStage.advanced=true;

  const top4=[p("c2060_01_luke","Luke"),p("c2060_31_rei","Rei"),p("c2060_03_daniel","Daniel"),p("c2060_17_cynthia","Cynthia")];
  world.top4Locked=true;
  world.top4=structuredClone(top4);
  const finalists=playerFinalist
    ? [p("c2060_01_luke","Luke"),p("c2060_03_daniel","Daniel")]
    : [p("c2060_31_rei","Rei"),p("c2060_03_daniel","Daniel")];

  const k=world.knockout;
  Object.assign(k,{
    opened:true,r16Resolved:true,top8Locked:true,playerAdvancedToQf:true,qfResolved:true,top4Locked:true,
    playerAdvancedToSf:true,sfOpened:true,sfResolved:true,finalistsLocked:true,playerAdvancedToFinal:playerFinalist,
    playerFinalMatchId:playerFinalist?"WORLD_FINAL_1":null,playerFinalOpponent:playerFinalist?structuredClone(finalists[1]):null
  });
  k.top4=structuredClone(top4);
  k.finalists=structuredClone(finalists);
  k.sfBracket=[
    {round:"SF",matchId:"WORLD_SF_1",home:structuredClone(top4[0]),away:structuredClone(top4[1]),outcome:playerFinalist?"win":"lose",playerOutcome:playerFinalist?"win":"lose",winnerId:playerFinalist?top4[0].id:top4[1].id,loserId:playerFinalist?top4[1].id:top4[0].id,resolvedAtMinutes:s.world.elapsedMinutes,source:"player_pokemon5e_combat"},
    {round:"SF",matchId:"WORLD_SF_2",home:structuredClone(top4[2]),away:structuredClone(top4[3]),outcome:"win",playerOutcome:null,winnerId:top4[2].id,loserId:top4[3].id,resolvedAtMinutes:null,source:"deterministic_offscreen_world_resolution"}
  ];
  k.sfResults=structuredClone(k.sfBracket);
  k.finalMatch={round:"FINAL",matchId:"WORLD_FINAL_1",home:structuredClone(finalists[0]),away:structuredClone(finalists[1]),outcome:null,playerOutcome:null,winnerId:null,loserId:null,resolvedAtMinutes:null,source:null};

  s.npcs.Daniel.schedule={id:"m11_final_test",locationId:"world_knockout_hall",availability:"available",activity:"final_four",startsAtMinutes:null,endsAtMinutes:null,present:false};
  return s;
}

async function friendBeat(engine,state,{physical=true}={}){
  let s=structuredClone(state);
  if(!physical){
    s.npcs.Daniel.schedule.locationId="world_village";
  }
  s.story.sceneId="m11-friend-beat-11";
  s.story.nodeId="selector";
  s=await engine.choose(s,"select_now");
  assert.equal(s.world.flags.friend_beat_11_friend_id,"Daniel");
  if(physical){
    assert.equal(s.world.flags.friend_beat_11_contact_mode,"physical");
    s.story.nodeId="physical_contact";
    s=await engine.choose(s,"physical_daniel");
  }else{
    assert.equal(s.world.flags.friend_beat_11_contact_mode,"remote");
    s.story.nodeId="remote_contact";
    s=await engine.choose(s,"remote_accept");
  }
  s.story.nodeId="commitment";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m11_friend_beat_11_complete,true);
  return s;
}

async function prepFinal(engine,state){
  let s=structuredClone(state);
  s.story.sceneId="m11-final-prep";
  s.story.nodeId="readiness";
  s=await engine.choose(s,"ready_commit");
  return s;
}

async function playFinal(engine,state,outcome="win"){
  let s=await prepFinal(engine,state);
  s.story.sceneId="m11-world-final";
  s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_final");
  assert.equal(s.pending.competition.worldKnockoutRound,"FINAL");
  assert.equal(s.pending.competition.matchId,"WORLD_FINAL_1");
  assert.equal(s.pending.competition.opponentTrainerId,"c2060_03_daniel");
  assert.equal(s.pending.opponent.trainerId,"c2060_03_daniel");
  assert.equal(1+s.pending.opponentBench.length,6);
  s=engine.resolveCombatHandoff(s,outcome);
  s=await engine.choose(s,outcome==="win"?"win_record":"loss_record");
  return s;
}

async function commitOutcome(engine,state,choice){
  let s=structuredClone(state);
  s.story.sceneId="m11-championship-outcome";
  s.story.nodeId="commit_guard";
  return engine.choose(s,choice);
}

test("M11_05 selects the actual friend final opponent and never changes the final pairing",async()=>{
  const {engine}=await makeEngine();
  const before=base({playerFinalist:true});
  const finalMatch=structuredClone(before.competition.world.knockout.finalMatch);
  let s=await friendBeat(engine,before,{physical:true});
  assert.equal(s.world.flags.friend_beat_11_context,"final_opponent");
  assert.equal(s.world.flags.friend_beat_11_type,"physical_final_four_contact");
  assert.equal(s.world.flags.friend_beat_11_result,"direct_exchange");
  assert.deepEqual(s.competition.world.knockout.finalMatch,finalMatch);
});

test("M11_05 after SF elimination selects a real remaining finalist and routes toward outcome",async()=>{
  const {engine}=await makeEngine();
  let s=await friendBeat(engine,base({playerFinalist:false}),{physical:false});
  assert.equal(s.world.flags.friend_beat_11_context,"world_finalist");
  s.story.sceneId="m11-friend-beat-11";
  s.story.nodeId="branch_gate";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="branch_final"),false);
  assert.ok(view.choices.some(c=>c.id==="branch_exit"));
});

test("M11_06 Final Prep advances time without healing or rebuilding the roster",async()=>{
  const {engine}=await makeEngine();
  let s=await friendBeat(engine,base({playerFinalist:true}),{physical:false});
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m11-final-prep";
  s.story.nodeId="time_budget";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"time_short");
  assert.equal(s.world.elapsedMinutes-before,15);
  assert.deepEqual(s.player.roster,roster);
  s.story.nodeId="readiness";
  s=await engine.choose(s,"ready_commit");
  assert.equal(s.world.flags.m11_final_prep_complete,true);
  assert.deepEqual(s.player.roster,roster);
});

test("M11_07 final win records Luke as the actual World Champion exactly once",async()=>{
  const {engine}=await makeEngine();
  let s=await friendBeat(engine,base({playerFinalist:true}),{physical:false});
  s=await playFinal(engine,s,"win");
  const k=s.competition.world.knockout;
  assert.equal(k.finalResolved,true);
  assert.equal(k.playerWonFinal,true);
  assert.equal(k.worldChampion.name,"Luke");
  assert.equal(k.worldRunnerUp.name,"Daniel");
  assert.equal(s.competition.world.currentWorldChampion.name,"Luke");
  assert.equal(s.world.flags.current_world_champion,"Luke");
  assert.equal(s.world.flags.world_champion,true);
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_FINAL_1").length,1);
  s.story.sceneId="m11-world-final";
  s.story.nodeId="match_handoff";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="fight_final"),false);
});

test("M11_07 final loss makes the actual opponent champion and Luke runner-up",async()=>{
  const {engine}=await makeEngine();
  let s=await friendBeat(engine,base({playerFinalist:true}),{physical:false});
  s=await playFinal(engine,s,"lose");
  const k=s.competition.world.knockout;
  assert.equal(k.finalResolved,true);
  assert.equal(k.playerWonFinal,false);
  assert.equal(k.worldChampion.name,"Daniel");
  assert.equal(k.worldRunnerUp.name,"Luke");
  assert.equal(s.competition.world.currentWorldChampion.name,"Daniel");
  assert.equal(s.world.flags.current_world_champion,"Daniel");
  assert.equal(s.world.flags.world_champion,false);
  assert.equal(s.world.flags.world_eliminated,true);
});

test("M11_08 resolves WORLD_FINAL offscreen after SF elimination before allowing WORLD_EXIT",async()=>{
  const {engine}=await makeEngine();
  let s=await friendBeat(engine,base({playerFinalist:false}),{physical:false});
  const historyBefore=structuredClone(s.competition.history);
  s.story.sceneId="m11-championship-outcome";
  s.story.nodeId="final_resolution";
  s=await engine.choose(s,"resolve_offscreen");
  const k=s.competition.world.knockout;
  assert.equal(k.finalResolved,true);
  assert.ok(["Rei","Daniel"].includes(k.worldChampion.name));
  assert.notEqual(k.worldChampion.name,"Luke");
  assert.equal(s.competition.world.currentWorldChampion.name,k.worldChampion.name);
  assert.deepEqual(s.competition.history,historyBefore);
  assert.equal(k.finalMatch.source,"deterministic_offscreen_world_resolution");
});

test("M11_08 champion, runner-up and SF-eliminated routes all unlock M12 without rewriting champion",async()=>{
  const {engine}=await makeEngine();

  let champion=await friendBeat(engine,base({playerFinalist:true}),{physical:false});
  champion=await playFinal(engine,champion,"win");
  const championName=champion.world?.flags?.current_world_champion;
  champion=await commitOutcome(engine,champion,"commit_champion");
  assert.equal(champion.world.flags.m11_complete,true);
  assert.equal(champion.world.flags.m12_unlocked,true);
  assert.equal(champion.world.flags.world_exit_available,true);
  assert.equal(champion.world.flags.m11_outcome_route,"world_champion");
  assert.equal(champion.world.flags.current_world_champion,championName);

  let runner=await friendBeat(engine,base({playerFinalist:true}),{physical:false});
  runner=await playFinal(engine,runner,"lose");
  const runnerChampion=runner.world.flags.current_world_champion;
  runner=await commitOutcome(engine,runner,"commit_runnerup");
  assert.equal(runner.world.flags.m11_outcome_route,"world_runner_up");
  assert.equal(runner.world.flags.m12_unlocked,true);
  assert.equal(runner.world.flags.current_world_champion,runnerChampion);

  let sfLoss=await friendBeat(engine,base({playerFinalist:false}),{physical:false});
  sfLoss.story.sceneId="m11-championship-outcome";
  sfLoss.story.nodeId="final_resolution";
  sfLoss=await engine.choose(sfLoss,"resolve_offscreen");
  const offscreenChampion=sfLoss.world.flags.current_world_champion;
  sfLoss=await commitOutcome(engine,sfLoss,"commit_sf_elim");
  assert.equal(sfLoss.world.flags.m11_outcome_route,"sf_eliminated");
  assert.equal(sfLoss.world.flags.m12_unlocked,true);
  assert.equal(sfLoss.world.flags.current_world_champion,offscreenChampion);
});

test("M11 offscreen Final resolution is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=await friendBeat(engine,base({playerFinalist:false}),{physical:false});
  s.story.sceneId="m11-championship-outcome";
  s.story.nodeId="final_resolution";
  s=await engine.choose(s,"resolve_offscreen");
  const finalMatch=structuredClone(s.competition.world.knockout.finalMatch);
  const champion=structuredClone(s.competition.world.currentWorldChampion);
  s.story.nodeId="final_resolution";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="resolve_offscreen"),false);
  assert.ok(view.choices.some(c=>c.id==="resolve_existing"));
  s=await engine.choose(s,"resolve_existing");
  assert.deepEqual(s.competition.world.knockout.finalMatch,finalMatch);
  assert.deepEqual(s.competition.world.currentWorldChampion,champion);
});

test("M11 full completion survives save/reload with champion, Friend Beat, roster and history intact",async()=>{
  let dir;
  try{
    const {engine}=await makeEngine();
    let s=await friendBeat(engine,base({playerFinalist:true}),{physical:false});
    s=await playFinal(engine,s,"win");
    s=await commitOutcome(engine,s,"commit_champion");
    dir=await mkdtemp(path.join(os.tmpdir(),"m11-complete-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load(s.slot);
    assert.deepEqual(loaded.competition.world,s.competition.world);
    assert.deepEqual(loaded.player.roster,s.player.roster);
    assert.deepEqual(loaded.competition.history,s.competition.history);
    assert.equal(loaded.world.flags.friend_beat_11_complete,true);
    assert.equal(loaded.world.flags.m11_complete,true);
    assert.equal(loaded.world.flags.current_world_champion,"Luke");
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
