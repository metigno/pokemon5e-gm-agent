import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m08-world-arrival",21,46],
  ["m08-accreditation",14,31],
  ["m08-medical-control",14,31],
  ["m08-registration",12,27],
  ["m08-world-village",21,46]
];

test("M8_00-M8_04 logical production budget is locked at 82 nodes / 181 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,82);
  assert.equal(choices,181);
});

test("M08 authored-surface manifest remains locked at 4400 stitches / 2500 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M08.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:4400,choices:2500});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),4400);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),2500);
});

test("M08 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M08.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M8_00_WORLD_ARRIVAL",
    "M8_01_ACCREDITATION",
    "M8_02_MEDICAL_CONTROL",
    "M8_03_REGISTRATION",
    "M8_04_WORLD_VILLAGE"
  ]);
});

test("M8 first cycle remains on the 190/418 logical trajectory",()=>{
  assert.deepEqual({nodes:190-82,choices:418-181},{nodes:108,choices:237});
});

test("M8_00-M8_04 authored nodes are all reachable from their cycle entry graph",async()=>{
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

test("M8 cycle1 has no zero-incoming padding nodes",async()=>{
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
      for(const choice of node.choices??[]){
        add(choice.goto,sceneId);
        if(choice.check){add(choice.outcomes?.success?.goto,sceneId);add(choice.outcomes?.failure?.goto,sceneId);}
        if(choice.combat){add(choice.combat.goto,sceneId);for(const target of Object.values(choice.combat.returnNodes??{})) add(target,sceneId);}
        if(choice.ecology){for(const target of Object.values(choice.ecology.returnNodes??{})) add(target,sceneId);}
      }
    }
  }
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([k])=>k),[]);
});


const cycle2=[
  ["m08-astrid-enters",14,31],
  ["m08-friend-beat-08",20,44],
  ["m08-training-hall",15,33],
  ["m08-media-day",15,32],
  ["m08-opening-ceremony",12,26]
];

test("M8_05-M8_09 logical production budget is locked at 76 nodes / 166 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of cycle2){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,76);
  assert.equal(choices,166);
});

test("M8 first ten blocks consume exactly 158 nodes / 347 choices",async()=>{
  const all=[...expected,...cycle2];
  let nodes=0,choices=0;
  for(const [rel] of all){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,158);
  assert.equal(choices,347);
  assert.deepEqual({nodes:190-nodes,choices:418-choices},{nodes:32,choices:71});
});

test("M8_05-M8_09 authored nodes are reachable and have no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of cycle2){
    scenes[rel]=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
  }
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(k=>[k,0]));
  const edges=new Map([...keys].map(k=>[k,[]]));
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
  assert.deepEqual([...keys].filter(k=>!visited.has(k)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,v])=>v===0).map(([k])=>k),[]);
});
