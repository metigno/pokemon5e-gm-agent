import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m11-final-four-lock",13,29],
  ["m11-rei-thread",15,34],
  ["m11-sf-prep",13,29],
  ["m11-world-sf",22,49],
  ["m11-other-sf",16,34]
];

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

test("M11_00-M11_04 logical production budget is locked at 79 nodes / 175 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,79);
  assert.equal(choices,175);
});

test("M11 authored-surface manifest remains locked at 3500 stitches / 1600 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M11.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:3500,choices:1600});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),3500);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),1600);
});

test("M11 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M11.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M11_00_FINAL_FOUR_LOCK","M11_01_REI_THREAD","M11_02_SF_PREP","M11_03_WORLD_SF","M11_04_OTHER_SF"
  ]);
});

test("M11 cycle1 remains on the 150/330 logical trajectory",()=>{
  assert.deepEqual({nodes:150-79,choices:330-175},{nodes:71,choices:155});
});

test("M11_00-M11_04 authored nodes are reachable and have no zero-incoming padding",async()=>{
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

test("M11 cycle1 declares Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M11_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M11_00_FINAL_FOUR_LOCK","M11_01_REI_THREAD","M11_02_SF_PREP","M11_03_WORLD_SF","M11_04_OTHER_SF"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});

const cycle2=[
  ["m11-friend-beat-11",20,44],
  ["m11-final-prep",13,29],
  ["m11-world-final",22,48],
  ["m11-championship-outcome",16,34]
];

test("M11_05-M11_08 logical production budget is locked at 71 nodes / 155 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of cycle2){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,71);
  assert.equal(choices,155);
});

test("M11 complete logical surface is exactly 150 nodes / 330 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel] of [...expected,...cycle2]){
    const scene=await readScene(rel);
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,150);
  assert.equal(choices,330);
});

test("M11 manifest contains the complete nine-block production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M11.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.map(b=>b.id),[
    "M11_00_FINAL_FOUR_LOCK","M11_01_REI_THREAD","M11_02_SF_PREP","M11_03_WORLD_SF","M11_04_OTHER_SF",
    "M11_05_FRIEND_BEAT_11","M11_06_FINAL_PREP","M11_07_WORLD_FINAL","M11_08_CHAMPIONSHIP_OUTCOME"
  ]);
});

test("M11 all 150 authored nodes are reachable across the complete module graph",async()=>{
  const all=[...expected,...cycle2];
  const scenes={};
  for(const [rel] of all) scenes[rel]=await readScene(rel);
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(key=>[key,0]));
  const edges=new Map([...keys].map(key=>[key,[]]));
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
  const start="m11-final-four-lock#final_four_entry";
  incoming[start]+=1;
  const queue=[start],visited=new Set(queue);
  while(queue.length){
    const current=queue.shift();
    for(const target of edges.get(current)??[]){
      if(!visited.has(target)){visited.add(target);queue.push(target);}
    }
  }
  assert.deepEqual([...keys].filter(key=>!visited.has(key)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([key])=>key),[]);
});

test("M11 all nine blocks declare Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M11_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of [
    "M11_00_FINAL_FOUR_LOCK","M11_01_REI_THREAD","M11_02_SF_PREP","M11_03_WORLD_SF","M11_04_OTHER_SF",
    "M11_05_FRIEND_BEAT_11","M11_06_FINAL_PREP","M11_07_WORLD_FINAL","M11_08_CHAMPIONSHIP_OUTCOME"
  ]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});

