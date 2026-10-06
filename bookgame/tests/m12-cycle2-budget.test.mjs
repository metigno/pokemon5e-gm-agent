import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const cycle1=[
  ["m12-world-exit-branch",19,42],["m12-return-asteria",13,28],["m12-valedarsena-callbacks",21,46],
  ["m12-bruma-callbacks",21,46],["m12-ferrox-callbacks",21,47]
];
const cycle2=[
  ["m12-coast-callbacks",21,47],["m12-highlands-callbacks",21,47],
  ["m12-interregional-callbacks",21,47],["m12-meridiana-callbacks",21,47]
];
async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}
test("M12_05-M12_08 logical production budget is locked at 84 nodes / 188 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of cycle2){
    const scene=await readScene(rel);
    const an=Object.keys(scene.nodes).length;
    const ac=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(an,n,rel+" node budget"); assert.equal(ac,c,rel+" choice budget");
    nodes+=an; choices+=ac;
  }
  assert.equal(nodes,84); assert.equal(choices,188);
});
test("M12 cumulative through M12_08 is exactly 179 nodes / 397 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel] of [...cycle1,...cycle2]){
    const scene=await readScene(rel);
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,179); assert.equal(choices,397);
});
test("M12 residual for M12_09-M12_11 is exactly 49 nodes / 105 meaningful choices",()=>{
  assert.deepEqual({nodes:228-179,choices:502-397},{nodes:49,choices:105});
});
test("M12 Ferrox handoff enters Cycle 2 and all 84 Cycle-2 nodes are reachable with no zero-incoming padding",async()=>{
  const ferrox=await readScene("m12-ferrox-callbacks");
  const handoff=ferrox.nodes.cycle1_complete.choices.find(c=>c.id==="to_coast");
  assert.equal(handoff?.goto,"m12-coast-callbacks#callback_entry");

  const scenes={};
  for(const [rel] of cycle2) scenes[rel]=await readScene(rel);
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)) for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  const incoming=Object.fromEntries([...keys].map(k=>[k,0]));
  const edges=new Map([...keys].map(k=>[k,[]]));
  const add=(raw,current,from)=>{
    if(typeof raw!=="string") return;
    const parts=raw.includes("#")?raw.split("#"):[current,raw];
    const target=parts[0]+"#"+parts[1];
    if(keys.has(target)){incoming[target]+=1;edges.get(from).push(target);}
  };
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const [nodeId,node] of Object.entries(scene.nodes)){
      const from=sceneId+"#"+nodeId;
      for(const choice of node.choices??[]) add(choice.goto,sceneId,from);
    }
  }
  const start="m12-coast-callbacks#callback_entry";
  incoming[start]+=1;
  const q=[start],seen=new Set(q);
  while(q.length){
    const cur=q.shift();
    for(const n of edges.get(cur)??[]) if(!seen.has(n)){seen.add(n);q.push(n);}
  }
  assert.deepEqual([...keys].filter(k=>!seen.has(k)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([k])=>k),[]);
});

test("M12_05-M12_08 declare Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M12_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M12_05_COAST_CALLBACKS","M12_06_HIGHLANDS_CALLBACKS","M12_07_INTERREGIONAL_CALLBACKS","M12_08_MERIDIANA_CALLBACKS"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});
