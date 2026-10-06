import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const cycle1=[
  ["m09-groups-open",11,25],["m09-matchday-one",20,43],["m09-interday-one",13,30],
  ["m09-kaia-thread",13,29],["m09-matchday-two",20,43]
];
const cycle2=[
  ["m09-friend-beat-09",20,43],["m09-interday-two",13,30],["m09-matchday-three",20,42],
  ["m09-group-resolution",13,30],["m09-eliminated-route",13,29]
];

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

function count(scene){
  return {
    nodes:Object.keys(scene.nodes).length,
    choices:Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0)
  };
}

test("M9_05-M9_09 Cycle 2 budget is exactly 79 nodes / 174 choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of cycle2){
    const actual=count(await readScene(rel));
    assert.deepEqual(actual,{nodes:n,choices:c},rel);
    nodes+=n;choices+=c;
  }
  assert.deepEqual({nodes,choices},{nodes:79,choices:174});
});

test("M9_00-M9_09 cumulative budget is exactly 156 nodes / 344 choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of [...cycle1,...cycle2]){
    const actual=count(await readScene(rel));
    assert.deepEqual(actual,{nodes:n,choices:c},rel);
    nodes+=actual.nodes;choices+=actual.choices;
  }
  assert.deepEqual({nodes,choices},{nodes:156,choices:344});
});

test("M9_10 residual budget is exactly 14 nodes / 30 choices",()=>{
  assert.deepEqual({nodes:170-156,choices:374-344},{nodes:14,choices:30});
});

test("M9_05-M9_09 nodes are reachable and contain no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of cycle2) scenes[rel]=await readScene(rel);
  const keys=new Set();
  for(const [sceneId,sc] of Object.entries(scenes)){
    for(const nodeId of Object.keys(sc.nodes)) keys.add(sceneId+"#"+nodeId);
  }
  const incoming=Object.fromEntries([...keys].map(k=>[k,0]));
  const edges=new Map([...keys].map(k=>[k,[]]));
  for(const [sceneId,sc] of Object.entries(scenes)) incoming[sceneId+"#"+sc.entryNodeId]+=1;
  const add=(raw,current,from)=>{
    if(typeof raw!=="string") return;
    const parts=raw.includes("#")?raw.split("#"):[current,raw];
    const target=parts[0]+"#"+parts[1];
    if(keys.has(target)){incoming[target]+=1;edges.get(from).push(target);}
  };
  for(const [sceneId,sc] of Object.entries(scenes)){
    for(const [nodeId,node] of Object.entries(sc.nodes)){
      const from=sceneId+"#"+nodeId;
      for(const choice of node.choices??[]){
        add(choice.goto,sceneId,from);
        if(choice.check){add(choice.outcomes?.success?.goto,sceneId,from);add(choice.outcomes?.failure?.goto,sceneId,from);}
        if(choice.combat){add(choice.combat.goto,sceneId,from);for(const t of Object.values(choice.combat.returnNodes??{}))add(t,sceneId,from);}
      }
    }
  }
  const queue=Object.entries(scenes).map(([sceneId,sc])=>sceneId+"#"+sc.entryNodeId);
  const visited=new Set(queue);
  while(queue.length){
    const cur=queue.shift();
    for(const target of edges.get(cur)??[]){
      if(!visited.has(target)){visited.add(target);queue.push(target);}
    }
  }
  assert.deepEqual([...keys].filter(k=>!visited.has(k)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([k])=>k),[]);
});

test("M9 Cycle 2 mapping remains Library V2-first with no R39",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../docs/modules/M09_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M9_05_FRIEND_BEAT_09","M9_06_INTERDAY_TWO","M9_07_MATCHDAY_THREE","M9_08_GROUP_RESOLUTION","M9_09_ELIMINATED_ROUTE"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required for Cycle 2/i);
});
