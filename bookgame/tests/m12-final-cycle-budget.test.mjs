import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const all=[
  ["m12-world-exit-branch",19,42],
  ["m12-return-asteria",13,28],
  ["m12-valedarsena-callbacks",21,46],
  ["m12-bruma-callbacks",21,46],
  ["m12-ferrox-callbacks",21,47],
  ["m12-coast-callbacks",21,47],
  ["m12-highlands-callbacks",21,47],
  ["m12-interregional-callbacks",21,47],
  ["m12-meridiana-callbacks",21,47],
  ["m12-friend-beat-12",21,46],
  ["m12-postgame-hooks",15,32],
  ["m12-main-story-complete",13,27]
];
const finalCycle=all.slice(9);

async function readScene(rel){
  return JSON.parse(await readFile(fileURLToPath(new URL("../content/scenes/"+rel+".json",import.meta.url)),"utf8"));
}

test("M12_09-M12_11 final cycle is exactly 49 nodes / 105 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel,n,c] of finalCycle){
    const scene=await readScene(rel);
    const an=Object.keys(scene.nodes).length;
    const ac=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
    assert.equal(an,n,rel+" node budget");
    assert.equal(ac,c,rel+" choice budget");
    nodes+=an;choices+=ac;
  }
  assert.equal(nodes,49);
  assert.equal(choices,105);
});

test("M12 complete runtime surface is exactly 228 nodes / 502 meaningful choices",async()=>{
  let nodes=0,choices=0;
  for(const [rel] of all){
    const scene=await readScene(rel);
    nodes+=Object.keys(scene.nodes).length;
    choices+=Object.values(scene.nodes).reduce((sum,node)=>sum+(node.choices?.length??0),0);
  }
  assert.equal(nodes,228);
  assert.equal(choices,502);
});

test("M12 authored-surface manifest remains locked at 4753 stitches / 1884 choices",async()=>{
  const manifest=JSON.parse(await readFile(fileURLToPath(new URL("../content/modules/M12.json",import.meta.url)),"utf8"));
  assert.deepEqual(manifest.targets,{stitches:4753,choices:1884});
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.stitches,0),4753);
  assert.equal(manifest.blocks.reduce((sum,b)=>sum+b.targets.choices,0),1884);
  assert.equal(manifest.blocks.length,12);
});

test("all 228 M12 nodes are reachable from WORLD_EXIT with no zero-incoming padding",async()=>{
  const scenes={};
  for(const [rel] of all) scenes[rel]=await readScene(rel);
  const keys=new Set();
  for(const [sceneId,scene] of Object.entries(scenes)){
    for(const nodeId of Object.keys(scene.nodes)) keys.add(sceneId+"#"+nodeId);
  }
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
      for(const choice of node.choices??[]){
        add(choice.goto,sceneId,from);
        if(choice.check){add(choice.outcomes?.success?.goto,sceneId,from);add(choice.outcomes?.failure?.goto,sceneId,from);}
        if(choice.combat){add(choice.combat.goto,sceneId,from);for(const t of Object.values(choice.combat.returnNodes??{}))add(t,sceneId,from);}
        if(choice.ecology){for(const t of Object.values(choice.ecology.returnNodes??{}))add(t,sceneId,from);}
      }
    }
  }
  const start="m12-world-exit-branch#world_exit_entry";
  incoming[start]+=1;
  const q=[start],seen=new Set(q);
  while(q.length){
    const cur=q.shift();
    for(const n of edges.get(cur)??[]) if(!seen.has(n)){seen.add(n);q.push(n);}
  }
  assert.deepEqual([...keys].filter(k=>!seen.has(k)),[]);
  assert.deepEqual(Object.entries(incoming).filter(([,n])=>n===0).map(([k])=>k),[]);
});

test("M12_09-M12_11 declare Library V2 reuse and no R39 requirement",async()=>{
  const mapping=await readFile(fileURLToPath(new URL("../../bookgame/docs/modules/M12_PRODUCTION_MAPPING.md",import.meta.url)),"utf8");
  for(const id of ["M12_09_FRIEND_BEAT_12","M12_10_POSTGAME_HOOKS","M12_11_MAIN_STORY_COMPLETE"]){
    assert.match(mapping,new RegExp(id+"[\\s\\S]*?Reuse class:","m"));
  }
  assert.match(mapping,/No R39 candidate is required|no R39 requirement/i);
});
