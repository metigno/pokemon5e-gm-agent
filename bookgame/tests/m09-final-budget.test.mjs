import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const all=[
  ["m09-groups-open",11,25],["m09-matchday-one",20,43],["m09-interday-one",13,30],
  ["m09-kaia-thread",13,29],["m09-matchday-two",20,43],["m09-friend-beat-09",20,43],
  ["m09-interday-two",13,30],["m09-matchday-three",20,42],["m09-group-resolution",13,30],
  ["m09-eliminated-route",13,29],["m09-advance-route",14,30]
];

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

test("M09 final logical budget is exactly 170 nodes / 374 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of all){
    const scene=await readScene(rel);
    const actualNodes=Object.keys(scene.nodes).length;
    const actualChoices=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(actualNodes,n,rel+" nodes");
    assert.equal(actualChoices,c,rel+" choices");
    nodes+=actualNodes;choices+=actualChoices;
  }
  assert.deepEqual({nodes,choices},{nodes:170,choices:374});
});

test("M9_10 owns the exact 14 / 30 residual budget",async()=>{
  const scene=await readScene("m09-advance-route");
  assert.equal(Object.keys(scene.nodes).length,14);
  assert.equal(Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0),30);
});

test("all M09 nodes have an incoming authored route and both terminal routes are connected",async()=>{
  const scenes={};
  for(const [rel] of all) scenes[rel]=await readScene(rel);
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(key=>[key,0]));
  const edges=new Map([...keys].map(key=>[key,[]]));
  incoming["m09-groups-open#groups_entry"]+=1;
  const add=(raw,current,from)=>{
    if(typeof raw!=="string") return;
    const parts=raw.includes("#")?raw.split("#"):[current,raw];
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
      }
    }
  }
  const queue=["m09-groups-open#groups_entry"];
  const visited=new Set(queue);
  while(queue.length){
    const current=queue.shift();
    for(const target of edges.get(current)??[]){
      if(!visited.has(target)){visited.add(target);queue.push(target);}
    }
  }
  assert.deepEqual([...keys].filter(key=>!visited.has(key)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([key])=>key),[]);
  assert.ok(visited.has("m09-eliminated-route#eliminated_entry"));
  assert.ok(visited.has("m09-advance-route#advance_entry"));
});

test("M09 mapping declares final Library V2 reuse and COMPLETE status",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../docs/modules/M09_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  assert.match(mapping,/M9_10_ADVANCE_ROUTE[\s\S]*?Reuse class:/m);
  assert.match(mapping,/Module implementation status:\*\* \*\*COMPLETE/i);
  assert.match(mapping,/No R39 candidate is required for M09/i);
});
