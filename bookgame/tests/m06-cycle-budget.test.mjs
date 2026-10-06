import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m06-handoff",11,25],
  ["m06-route-selection",13,29],
  ["m06-interregional-travel",13,29],
  ["m06-red-enters",13,29],
  ["m06-masters-circuit",14,29]
];

test("M6_00-M6_04 logical production budget is locked at 64 nodes / 141 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,64);
  assert.equal(choices,141);
});

test("M06 authored-surface manifest remains locked at 5500 stitches / 3400 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M06.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:5500,choices:3400});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),5500);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),3400);
});

test("M06 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M06.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M6_00_RANK_A_HANDOFF",
    "M6_01_ROUTE_SELECTION",
    "M6_02_INTERREGIONAL_TRAVEL",
    "M6_03_RED_ENTERS",
    "M6_04_MASTERS_CIRCUIT"
  ]);
});

test("M6 first cycle remains on the 220/484 logical trajectory",async()=>{
  const remaining={nodes:220-64,choices:484-141};
  assert.deepEqual(remaining,{nodes:156,choices:343});
});
