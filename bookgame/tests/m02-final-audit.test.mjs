import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const mappingFile=fileURLToPath(new URL("../docs/modules/M02_PRODUCTION_MAPPING.md",import.meta.url));

const blocks=[
  ["M2_00","m02-rank-e-handoff",2,3],
  ["M2_01","m02-mistwood-entry",8,14],
  ["M2_02","m02-capture-signs",18,41],
  ["M2_03","m02-borgo-salice",14,41],
  ["M2_04","m02-n-enters",23,46],
  ["M2_05","m02-ranger-thread",10,20],
  ["M2_06","m02-marsh-approach",10,15],
  ["M2_07","m02-poaching-network",18,38],
  ["M2_08","m02-friend-beat-02",25,44],
  ["M2_09","m02-rookie-invitational",16,28],
  ["M2_10","m02-crisis-moves",11,26],
  ["M2_11","m02-network-outcome",15,39],
  ["M2_12","m02-trial-registration",19,60],
  ["M2_13","m02-promotion-trial-e-d",17,26],
  ["M2_14","m02-trial-result",14,43]
];

async function loadScene(name){
  return JSON.parse(await readFile(path.join(scenesDir,name+".json"),"utf8"));
}

test("M02 owns exactly M2_00 through M2_14 scene files",async()=>{
  const files=(await readdir(scenesDir)).filter(n=>n.startsWith("m02-")&&n.endsWith(".json")).sort();
  const expected=blocks.map(([,name])=>name+".json").sort();
  assert.deepEqual(files,expected);
});

test("M02 exact physical budget is 220 nodes / 484 choices",async()=>{
  let nodes=0,choices=0;
  for(const [block,name,expectedNodes,expectedChoices] of blocks){
    const scene=await loadScene(name);
    const n=Object.keys(scene.nodes).length;
    const c=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length||0),0);
    assert.equal(n,expectedNodes,block+" node count");
    assert.equal(c,expectedChoices,block+" choice count");
    nodes+=n; choices+=c;
  }
  assert.equal(nodes,220);
  assert.equal(choices,484);
});

test("M03 stub module and handoff scene do not exist",async()=>{
  await assert.rejects(()=>access(path.join(modulesDir,"M03.json"),constants.F_OK),{code:"ENOENT"});
  await assert.rejects(()=>access(path.join(scenesDir,"m03-handoff.json"),constants.F_OK),{code:"ENOENT"});
});

test("M02 scenes contain no authored M3 cross-scene goto",async()=>{
  for(const [,name] of blocks){
    const raw=await readFile(path.join(scenesDir,name+".json"),"utf8");
    assert.equal(raw.includes("m03-handoff"),false,name);
    assert.equal(raw.includes("#m03_"),false,name);
  }
});

test("M2_11 is the only final poaching_network_state writer after network discovery",async()=>{
  const m211=await readFile(path.join(scenesDir,"m02-network-outcome.json"),"utf8");
  assert.equal((m211.match(/"key": "poaching_network_state"/g)||[]).length,4);
  for(const name of ["m02-trial-registration","m02-promotion-trial-e-d","m02-trial-result"]){
    const raw=await readFile(path.join(scenesDir,name+".json"),"utf8");
    assert.equal(raw.includes('"key": "poaching_network_state"'),false,name);
  }
});

test("M2_12 stores an explicit Official Three confirmation before registration",async()=>{
  const scene=await loadScene("m02-trial-registration");
  const confirm=scene.nodes.official_three_confirm.choices.find(c=>c.id==="confirm_official_three");
  assert.ok(confirm);
  assert.deepEqual(confirm.effects,[{type:"competition_trial_register",checkpointId:"RANK_E_TO_D"}]);
  assert.equal(scene.nodes.trial_desk.choices.find(c=>c.id==="register_now").effects,undefined);
});

test("M2_13 fixed opponent roster is authored and has no scaling field",async()=>{
  const scene=await loadScene("m02-promotion-trial-e-d");
  const begin=scene.nodes.trial_ines_briefing.choices.find(c=>c.id==="begin_trial");
  const combat=begin.combat;
  assert.equal(combat.opponentTrainerId,"SAL_GATE_E_D_INES_VARGA");
  assert.deepEqual(
    [[combat.opponent.species,combat.opponent.level],...combat.opponentBench.map(p=>[p.species,p.level])],
    [["Growlithe",5],["Roselia",5],["Sableye",4]]
  );
  assert.equal("scaling" in combat,false);
  assert.equal(combat.competition.difficulty,"HARD");
  assert.equal(combat.competition.officialRosterSize,3);
});

test("M2_14 completion has no M3 transition and only unlocks state",async()=>{
  const scene=await loadScene("m02-trial-result");
  const raw=JSON.stringify(scene);
  assert.equal(raw.includes("m03-handoff"),false);
  const complete=scene.nodes.trial_win.choices.find(c=>c.id==="complete_m2_exit");
  assert.deepEqual(complete.effects,[
    {type:"set_flag",key:"m2_complete",value:true},
    {type:"set_flag",key:"m03_unlocked",value:true}
  ]);
});

test("final production mapping reports the exact M02-only budget",async()=>{
  const doc=await readFile(mappingFile,"utf8");
  assert.match(doc,/\*\*TOTAL M02\*\*[\s\S]*\*\*220\*\*[\s\S]*\*\*484\*\*/);
  assert.match(doc,/pre-repair M02-only baseline was \*\*189 nodes \/ 409 choices\*\*/);
  assert.match(doc,/M02 does \*\*not\*\* author M3/);
});
