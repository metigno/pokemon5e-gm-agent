import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m10-r16-bracket",15,32],
  ["m10-silas-thread",15,32],
  ["m10-r16-prep",12,27],
  ["m10-world-r16",21,47],
  ["m10-r16-aftermath",15,33]
];

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

test("M10_00-M10_04 logical production budget is locked at 78 nodes / 171 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,78);
  assert.equal(choices,171);
});

test("M10 authored-surface manifest remains locked at 4000 stitches / 2000 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M10.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:4000,choices:2000});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),4000);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),2000);
});

test("M10 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M10.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M10_00_R16_BRACKET",
    "M10_01_SILAS_THREAD",
    "M10_02_R16_PREP",
    "M10_03_WORLD_R16",
    "M10_04_R16_AFTERMATH"
  ]);
});

test("M10 cycle1 remains on the 160/352 logical trajectory",()=>{
  assert.deepEqual({nodes:160-78,choices:352-171},{nodes:82,choices:181});
});

test("M10_00-M10_04 authored nodes are reachable and have no zero-incoming padding",async()=>{
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

test("M10 cycle1 declares Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M10_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M10_00_R16_BRACKET","M10_01_SILAS_THREAD","M10_02_R16_PREP","M10_03_WORLD_R16","M10_04_R16_AFTERMATH"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});


const cycle2=[
  ["m10-friend-beat-10",22,48],
  ["m10-qf-prep",12,27],
  ["m10-world-qf",21,47],
  ["m10-qf-aftermath",15,33],
  ["m10-module-outcome",12,29]
];

test("M10_05-M10_09 logical production budget is locked at 82 nodes / 184 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of cycle2){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,82);
  assert.equal(choices,184);
});

test("M10 complete logical surface is exactly 160 nodes / 355 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel] of [...expected,...cycle2]){
    const scene=await readScene(rel);
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,160);
  assert.equal(choices,355);
});

test("M10_05-M10_09 authored nodes are reachable and have no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of cycle2) scenes[rel]=await readScene(rel);
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

test("M10 all ten blocks declare Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M10_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of [
    "M10_00_R16_BRACKET","M10_01_SILAS_THREAD","M10_02_R16_PREP","M10_03_WORLD_R16","M10_04_R16_AFTERMATH",
    "M10_05_FRIEND_BEAT_10","M10_06_QF_PREP","M10_07_WORLD_QF","M10_08_QF_AFTERMATH","M10_09_MODULE_OUTCOME"
  ]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});
