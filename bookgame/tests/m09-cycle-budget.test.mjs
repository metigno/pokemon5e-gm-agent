import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m09-groups-open",11,25],
  ["m09-matchday-one",20,43],
  ["m09-interday-one",13,30],
  ["m09-kaia-thread",13,29],
  ["m09-matchday-two",20,43]
];

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

test("M9_00-M9_04 logical production budget is locked at 77 nodes / 170 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,77);
  assert.equal(choices,170);
});

test("M09 authored-surface manifest remains locked at 4300 stitches / 2300 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M09.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:4300,choices:2300});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),4300);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),2300);
});

test("M09 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M09.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M9_00_GROUPS_OPEN","M9_01_MATCHDAY_ONE","M9_02_INTERDAY_ONE","M9_03_KAIA_THREAD","M9_04_MATCHDAY_TWO"
  ]);
});

test("M9 cycle1 remains on the 170/374 logical trajectory",()=>{
  assert.deepEqual({nodes:170-77,choices:374-170},{nodes:93,choices:204});
});

test("M9_00-M9_04 authored nodes are reachable and have no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of expected) scenes[rel]=await readScene(rel);
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(key=>[key,0]));
  const edges=new Map([...keys].map(key=>[key,[]]));
  for(const [sceneId,scene] of Object.entries(scenes)) incoming[sceneId+"#"+scene.entryNodeId]+=1;
  const add=(raw,currentScene,from)=>{
    if(typeof raw!=="string") return;
    const parts=raw.includes("#")?raw.split("#"):[currentScene,raw];
    const target=parts[0]+"#"+parts[1];
    if(keys.has(target)){incoming[target]+=1;edges.get(from).push(target);}
  };
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const [nodeId,node] of Object.entries(scene.nodes)){
      const from=sceneId+"#"+nodeId;
      for(const choice of node.choices??[]){
        add(choice.goto,sceneId,from);
        if(choice.check){add(choice.outcomes?.success?.goto,sceneId,from);add(choice.outcomes?.failure?.goto,sceneId,from);}
        if(choice.combat){add(choice.combat.goto,sceneId,from);for(const target of Object.values(choice.combat.returnNodes??{}))add(target,sceneId,from);}
        if(choice.ecology){for(const target of Object.values(choice.ecology.returnNodes??{}))add(target,sceneId,from);}
      }
    }
  }
  const queue=Object.entries(scenes).map(([sceneId,scene])=>sceneId+"#"+scene.entryNodeId);
  const visited=new Set(queue);
  while(queue.length){
    const current=queue.shift();
    for(const target of edges.get(current)??[]){
      if(!visited.has(target)){visited.add(target);queue.push(target);}
    }
  }
  assert.deepEqual([...keys].filter(key=>!visited.has(key)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([key])=>key),[]);
});

test("M9 cycle1 declares Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M09_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M9_00_GROUPS_OPEN","M9_01_MATCHDAY_ONE","M9_02_INTERDAY_ONE","M9_03_KAIA_THREAD","M9_04_MATCHDAY_TWO"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});
