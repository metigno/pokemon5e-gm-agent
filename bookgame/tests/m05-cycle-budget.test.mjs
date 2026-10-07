import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const files=[
  "../content/scenes/m05-handoff.json",
  "../content/scenes/m05-mountain-approach.json",
  "../content/scenes/m05-altacima.json",
  "../content/scenes/m05-lance-enters.json",
  "../content/scenes/m05-weather-decisions.json"
];

test("M5_00-M5_04 logical production budget is locked at 75 nodes / 166 meaningful choices",async()=>{
  let nodes=0;
  let choices=0;
  for(const rel of files){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL(rel,import.meta.url)),"utf8"));
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,75);
  assert.equal(choices,166);
});

test("M05 authored-surface manifest remains locked at 5700 stitches / 3600 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M05.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:5700,choices:3600});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),5700);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),3600);
});

test("M05 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M05.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M5_00_RANK_B_HANDOFF",
    "M5_01_MOUNTAIN_APPROACH",
    "M5_02_ALTACIMA",
    "M5_03_LANCE_ENTERS",
    "M5_04_WEATHER_DECISIONS"
  ]);
});


test("M5_05-M5_09 logical production budget is locked per block",async()=>{
  const expected=[
    ["m05-fulgore-ascent",19,40],
    ["m05-ancient-trace",15,34],
    ["m05-interregional-license",15,34],
    ["m05-five-cross-again",15,33],
    ["m05-friend-beat-05",22,48]
  ];
  let totalNodes=0,totalChoices=0;
  for(const [rel,nodes,choices] of expected){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,nodes,rel+" node budget");
    assert.equal(actualChoices,choices,rel+" choice budget");
    totalNodes+=actualNodes; totalChoices+=actualChoices;
  }
  assert.equal(totalNodes,86);
  assert.equal(totalChoices,189);
});

test("M5 first ten blocks include the canonical Fulgore capture expansion",async()=>{
  const rels=[
    "m05-handoff","m05-mountain-approach","m05-altacima","m05-lance-enters","m05-weather-decisions",
    "m05-fulgore-ascent","m05-ancient-trace","m05-interregional-license","m05-five-cross-again","m05-friend-beat-05"
  ];
  let nodes=0,choices=0;
  for(const rel of rels){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,161);
  assert.equal(choices,355);
  assert.equal(244-nodes,83);
  assert.equal(536-choices,181);
});


test("M5_10-M5_14 logical production budget is locked per block",async()=>{
  const expected=[
    ["m05-high-altitude-event",15,32],
    ["m05-trial-registration",14,31],
    ["m05-promotion-trial-b-a",22,48],
    ["m05-masters-entry",18,40],
    ["m05-module-outcome",14,30]
  ];
  let totalNodes=0,totalChoices=0;
  for(const [rel,nodes,choices] of expected){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,nodes,rel+" node budget");
    assert.equal(actualChoices,choices,rel+" choice budget");
    totalNodes+=actualNodes;totalChoices+=actualChoices;
  }
  assert.equal(totalNodes,83);
  assert.equal(totalChoices,181);
});

test("M5 complete logical runtime surface is 244 nodes / 536 choices after canonical capture expansion",async()=>{
  const rels=[
    "m05-handoff","m05-mountain-approach","m05-altacima","m05-lance-enters","m05-weather-decisions",
    "m05-fulgore-ascent","m05-ancient-trace","m05-interregional-license","m05-five-cross-again","m05-friend-beat-05",
    "m05-high-altitude-event","m05-trial-registration","m05-promotion-trial-b-a","m05-masters-entry","m05-module-outcome"
  ];
  let nodes=0,choices=0;
  for(const rel of rels){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,244);
  assert.equal(choices,536);
});
