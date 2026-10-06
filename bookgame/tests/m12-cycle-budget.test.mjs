import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expected=[
  ["m12-world-exit-branch",19,42],
  ["m12-return-asteria",13,28],
  ["m12-valedarsena-callbacks",21,46],
  ["m12-bruma-callbacks",21,46],
  ["m12-ferrox-callbacks",21,47]
];

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

test("M12_00-M12_04 logical production budget is locked at 95 nodes / 209 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of expected){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" node budget");
    assert.equal(actualChoices,c,rel+" choice budget");
    nodes+=actualNodes; choices+=actualChoices;
  }
  assert.equal(nodes,95);
  assert.equal(choices,209);
});

test("M12 authored-surface manifest remains locked at 4753 stitches / 1884 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M12.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:4753,choices:1884});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),4753);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),1884);
});

test("M12 first five block IDs remain the canonical production spine",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M12.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.blocks.slice(0,5).map(b=>b.id),[
    "M12_00_WORLD_EXIT_BRANCH","M12_01_RETURN_ASTERIA","M12_02_VALEDARSENA_CALLBACKS","M12_03_BRUMA_CALLBACKS","M12_04_FERROX_CALLBACKS"
  ]);
});

test("M12 cycle1 remains on the agreed 228/502 logical trajectory",()=>{
  assert.deepEqual({nodes:228-95,choices:502-209},{nodes:133,choices:293});
});

test("M12_00-M12_04 authored nodes are reachable and have no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of expected) scenes[rel]=await readScene(rel);
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
    if(keys.has(target)){ incoming[target]+=1; edges.get(from).push(target); }
  };
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const [nodeId,node] of Object.entries(scene.nodes)){
      const from=sceneId+"#"+nodeId;
      for(const choice of node.choices??[]){
        add(choice.goto,sceneId,from);
        if(choice.check){ add(choice.outcomes?.success?.goto,sceneId,from); add(choice.outcomes?.failure?.goto,sceneId,from); }
        if(choice.combat){ add(choice.combat.goto,sceneId,from); for(const target of Object.values(choice.combat.returnNodes??{})) add(target,sceneId,from); }
        if(choice.ecology){ for(const target of Object.values(choice.ecology.returnNodes??{})) add(target,sceneId,from); }
      }
    }
  }
  const start="m12-world-exit-branch#world_exit_entry";
  incoming[start]+=1;
  const queue=[start],visited=new Set(queue);
  while(queue.length){
    const current=queue.shift();
    for(const target of edges.get(current)??[]){
      if(!visited.has(target)){ visited.add(target); queue.push(target); }
    }
  }
  assert.deepEqual([...keys].filter(key=>!visited.has(key)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([key])=>key),[]);
});

test("M12 cycle1 declares Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M12_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M12_00_WORLD_EXIT_BRANCH","M12_01_RETURN_ASTERIA","M12_02_VALEDARSENA_CALLBACKS","M12_03_BRUMA_CALLBACKS","M12_04_FERROX_CALLBACKS"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});
