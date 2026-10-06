import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m07-handoff",12,26],
  ["m07-meridiana-arrival",14,31],
  ["m07-cynthia-enters",14,31],
  ["m07-media-sponsor",14,31],
  ["m07-pro-preparation",12,26]
];

test("M7_00-M7_04 logical production budget is locked at 66 nodes / 145 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,66);
  assert.equal(choices,145);
});

test("M07 authored-surface manifest remains locked at 5200 stitches / 3200 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M07.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:5200,choices:3200});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),5200);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),3200);
});

test("M07 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M07.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M7_00_RANK_S_HANDOFF",
    "M7_01_MERIDIANA_ARRIVAL",
    "M7_02_CYNTHIA_ENTERS",
    "M7_03_MEDIA_SPONSOR",
    "M7_04_PRO_PREPARATION"
  ]);
});

test("M7 first cycle remains on the 210/462 logical trajectory",()=>{
  assert.deepEqual({nodes:210-66,choices:462-145},{nodes:144,choices:317});
});

test("M7_00-M7_04 authored nodes are all reachable from their cycle entry graph",async()=>{
  const scenes={};
  for(const [rel] of expected){
    scenes[rel]=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
  }
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const edges=new Map([...keys].map(key=>[key,[]]));
  const add=(raw,currentScene,from)=>{
    if(typeof raw!=="string") return;
    const parts=raw.includes("#")?raw.split("#"):[currentScene,raw];
    const target=parts[0]+"#"+parts[1];
    if(keys.has(target)) edges.get(from).push(target);
  };
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const [nodeId,node] of Object.entries(scene.nodes)){
      const from=sceneId+"#"+nodeId;
      for(const choice of node.choices??[]){
        add(choice.goto,sceneId,from);
        if(choice.check){add(choice.outcomes?.success?.goto,sceneId,from);add(choice.outcomes?.failure?.goto,sceneId,from);}
        if(choice.combat){add(choice.combat.goto,sceneId,from);for(const target of Object.values(choice.combat.returnNodes??{})) add(target,sceneId,from);}
        if(choice.ecology){for(const target of Object.values(choice.ecology.returnNodes??{})) add(target,sceneId,from);}
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
});

test("M7 cycle1 has no zero-incoming padding nodes",async()=>{
  const scenes={};
  for(const [rel] of expected){
    scenes[rel]=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
  }
  const incoming={};
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) incoming[sceneId+"#"+nodeId]=0;
    incoming[sceneId+"#"+scene.entryNodeId]+=1;
  }
  const add=(raw,currentScene)=>{
    if(typeof raw!=="string") return;
    const parts=raw.includes("#")?raw.split("#"):[currentScene,raw];
    const target=parts[0]+"#"+parts[1];
    if(Object.hasOwn(incoming,target)) incoming[target]+=1;
  };
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const node of Object.values(scene.nodes)){
      for(const choice of node.choices??[]) add(choice.goto,sceneId);
    }
  }
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([k])=>k),[]);
});
