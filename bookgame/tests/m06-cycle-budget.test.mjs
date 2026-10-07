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

const cycle2=[
  ["m06-hidden-trajectories",13,29],
  ["m06-friend-beat-06",19,42],
  ["m06-continental-entry",12,25],
  ["m06-continental-cup",19,42],
  ["m06-ancient-layer-two",13,29]
];

const cycle3=[
  ["m06-first-lighthouse-return",13,30],
  ["m06-trial-registration",17,38],
  ["m06-promotion-trial-a-s",19,42],
  ["m06-world-cutoff",19,42],
  ["m06-module-outcome",12,25]
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

test("M6 first cycle remains on the 220/485 logical trajectory",async()=>{
  const remaining={nodes:220-64,choices:485-141};
  assert.deepEqual(remaining,{nodes:156,choices:344});
});

test("M6_00-M6_04 authored nodes are all reachable from their cycle entry graph",async()=>{
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
        if(choice.check){
          add(choice.outcomes?.success?.goto,sceneId,from);
          add(choice.outcomes?.failure?.goto,sceneId,from);
        }
        if(choice.combat){
          add(choice.combat.goto,sceneId,from);
          for(const target of Object.values(choice.combat.returnNodes??{})) add(target,sceneId,from);
        }
        if(choice.ecology){
          for(const target of Object.values(choice.ecology.returnNodes??{})) add(target,sceneId,from);
        }
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

test("M6_05-M6_09 logical production budget is locked at 76 nodes / 167 meaningful choices",async()=>{
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
  assert.equal(choices,167);
});

test("M6 first ten blocks consume exactly 140 nodes / 308 choices",async()=>{
  const all=[...expected,...cycle2];
  let nodes=0,choices=0;
  for(const [rel] of all){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,140);
  assert.equal(choices,308);
  assert.deepEqual({nodes:220-nodes,choices:485-choices},{nodes:80,choices:177});
});

test("M6_05-M6_09 authored nodes have no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of cycle2){
    scenes[rel]=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
  }
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(key=>[key,0]));
  for(const [sceneId,scene] of Object.entries(scenes)){
    incoming[sceneId+"#"+scene.entryNodeId]+=1;
    const add=(raw)=>{
      if(typeof raw!=="string") return;
      const parts=raw.includes("#")?raw.split("#"):[sceneId,raw];
      const target=parts[0]+"#"+parts[1];
      if(Object.hasOwn(incoming,target)) incoming[target]+=1;
    };
    for(const node of Object.values(scene.nodes)){
      for(const choice of node.choices??[]){
        add(choice.goto);
        if(choice.check){add(choice.outcomes?.success?.goto);add(choice.outcomes?.failure?.goto);}
        if(choice.combat){add(choice.combat.goto);for(const target of Object.values(choice.combat.returnNodes??{})) add(target);}
        if(choice.ecology){for(const target of Object.values(choice.ecology.returnNodes??{})) add(target);}
      }
    }
  }
  assert.deepEqual(Object.entries(incoming).filter(([,count])=>count===0).map(([key])=>key),[]);
});

test("M6_10-M6_14 logical production budget is locked at 80 nodes / 177 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of cycle3){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.equal(nodes,80);
  assert.equal(choices,177);
});

test("M6 complete runtime surface is exactly 220 nodes / 485 meaningful choices",async()=>{
  const all=[...expected,...cycle2,...cycle3];
  let nodes=0,choices=0;
  for(const [rel] of all){
    const scene=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,220);
  assert.equal(choices,485);
});

test("M6_10-M6_14 authored nodes have no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of cycle3){
    scenes[rel]=JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
  }
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(key=>[key,0]));
  for(const [sceneId,scene] of Object.entries(scenes)){
    incoming[sceneId+"#"+scene.entryNodeId]+=1;
    const add=(raw)=>{
      if(typeof raw!=="string") return;
      const parts=raw.includes("#")?raw.split("#"):[sceneId,raw];
      const target=parts[0]+"#"+parts[1];
      if(Object.hasOwn(incoming,target)) incoming[target]+=1;
    };
    for(const node of Object.values(scene.nodes)){
      for(const choice of node.choices??[]){
        add(choice.goto);
        if(choice.check){add(choice.outcomes?.success?.goto);add(choice.outcomes?.failure?.goto);}
        if(choice.combat){add(choice.combat.goto);for(const target of Object.values(choice.combat.returnNodes??{})) add(target);}
        if(choice.ecology){for(const target of Object.values(choice.ecology.returnNodes??{})) add(target);}
      }
    }
  }
  assert.deepEqual(Object.entries(incoming).filter(([,count])=>count===0).map(([key])=>key),[]);
});

test("M6 complete graph is reachable from the real M6 entry with no padding islands",async()=>{
  const all=[...expected,...cycle2,...cycle3];
  const scenes={};
  for(const [rel] of all){
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
        if(choice.check){
          add(choice.outcomes?.success?.goto,sceneId,from);
          add(choice.outcomes?.failure?.goto,sceneId,from);
        }
        if(choice.combat){
          add(choice.combat.goto,sceneId,from);
          for(const target of Object.values(choice.combat.returnNodes??{})) add(target,sceneId,from);
        }
        if(choice.ecology){
          for(const target of Object.values(choice.ecology.returnNodes??{})) add(target,sceneId,from);
        }
      }
    }
  }
  const start="m06-handoff#m06_entry";
  const queue=[start];
  const visited=new Set(queue);
  while(queue.length){
    const current=queue.shift();
    for(const target of edges.get(current)??[]){
      if(!visited.has(target)){visited.add(target);queue.push(target);}
    }
  }
  assert.equal(visited.size,220);
  assert.deepEqual([...keys].filter(key=>!visited.has(key)),[]);
});
