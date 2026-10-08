import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FRIEND_NPC_CANON } from "../rules/friend-npc-canon.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const MAP_PATH=path.join(ROOT,"assets/pokemon/sprite-runtime-map.json");
const NPC_PATH=path.join(ROOT,"content/npcs/NPC_CHARACTER_LIBRARY_V1.json");
const SCENE_DIR=path.join(ROOT,"content/scenes");

export function canonicalSpriteId(name){
  if(typeof name!=="string"||!name.trim()) return null;
  let s=name.trim();
  if(/^gmax[ -]/i.test(s)||/gigantamax/i.test(s)) throw new Error("Gigantamax reference is forbidden: "+name);
  if(/^mega[ -]/i.test(s)) return "mega-"+slug(s.replace(/^mega[ -]/i,""));
  const regional=s.match(/^Hisuian[ -](.+)$/i);
  if(regional) return slug(regional[1])+"-hisui";
  return slug(s)
    .replace(/-hisuian$/,"-hisui")
    .replace(/-alolan$/,"-alola")
    .replace(/-galarian$/,"-galar")
    .replace(/-paldean$/,"-paldea")
    .replace(/^rotom-w$/,"rotom-wash");
}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}

function collectSpeciesFields(value,out,source){
  if(Array.isArray(value)){for(const v of value) collectSpeciesFields(v,out,source);return;}
  if(!value||typeof value!=="object") return;
  for(const [k,v] of Object.entries(value)){
    if(k==="species"&&typeof v==="string"&&v.toLowerCase()!=="trainer") out.push({name:v,source});
    collectSpeciesFields(v,out,source);
  }
}
export function collectCoverageReferences(){
  const refs=[];
  for(const [friend,data] of Object.entries(FRIEND_NPC_CANON)){
    for(const chain of data.rosterPlan) for(const name of chain) refs.push({name,source:"Five:"+friend});
  }
  const npc=JSON.parse(fs.readFileSync(NPC_PATH,"utf8"));
  for(const [trainer,team] of Object.entries(npc.anchorWorldEndpoints??{}))
    for(const name of team) refs.push({name,source:"Anchor:"+trainer});
  for(const file of fs.readdirSync(SCENE_DIR).filter(x=>x.endsWith(".json"))){
    const doc=JSON.parse(fs.readFileSync(path.join(SCENE_DIR,file),"utf8"));
    collectSpeciesFields(doc,refs,"Scene:"+file);
  }
  return refs;
}
export function validateCanonicalSpriteCoverage(){
  const map=JSON.parse(fs.readFileSync(MAP_PATH,"utf8"));
  const missing=[],forbidden=[],seen=new Set();
  for(const ref of collectCoverageReferences()){
    try{
      const id=canonicalSpriteId(ref.name);
      if(!id||seen.has(id+"|"+ref.source)) continue;
      seen.add(id+"|"+ref.source);
      const mappedId=map.aliasIndex?.[id]??id;
      if(!map.sprites[mappedId]) missing.push({...ref,id});
    }catch(error){forbidden.push({...ref,error:error.message});}
  }
  return {valid:missing.length===0&&forbidden.length===0,missing,forbidden};
}
