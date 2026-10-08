import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WORLD_2060_SPECIES } from "../src/rules/world-roster-2060.mjs";
import {
  validateSecondaryCatalog, verifyOfflineSecondaryNpcAssets,
  readVerifiedSecondaryNpcSprite, npcSceneRoles, npcWorldSpriteId,
  NPC_SECONDARY_CATALOG_SHA256, NPC_SECONDARY_ZIP_SHA256
} from "../src/assets/npc-secondary-assets.mjs";

const roles = ["nurse","doctor","mart_clerk","receptionist","registrar","ranger_m",
  "ranger_f","worker_m","worker_f","technician","security","referee","reporter_m",
  "reporter_f","trainer_m","trainer_f","rookie","guide","harbor_official","researcher",
  "field_staff","organizer","vendor","trainer_staff"];
const sha = b => createHash("sha256").update(b).digest("hex");
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(buf) {
  let c=0xffffffff;
  for(const b of buf) { c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0); }
  return (c^0xffffffff)>>>0;
}
function chunk(tag,content) {
  const key=Buffer.from(tag);
  const length=Buffer.alloc(4);length.writeUInt32BE(content.length);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([key,content])));
  return Buffer.concat([length,key,content,crc]);
}
function png(w,h) {
  const hd=Buffer.alloc(13);hd.writeUInt32BE(w,0);hd.writeUInt32BE(h,4);hd[8]=8;hd[9]=6;
  const data=Buffer.alloc(h*(w*4+1));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) data[y*(w*4+1)+1+x*4+3]=255;
  return Buffer.concat([sig,chunk("IHDR",hd),chunk("IDAT",deflateSync(data)),chunk("IEND",Buffer.alloc(0))]);
}
function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),"npc-secondary-test-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const registry=JSON.parse(await readFile(new URL("../content/npcs/NPC_CHARACTER_LIBRARY_V1.json",import.meta.url),"utf8"));
  const known=new Set([...registry.five,...registry.moduleAnchors,...registry.verifiedAdditionalCharacters].map(e=>e.name));
  const names=Object.keys(WORLD_2060_SPECIES).filter(s=>!known.has(s));
  assert.equal(names.length,18);
  const catalog={schemaVersion:1,worldEntrants:{},roles:{},sceneRoles:{
    "m08-medical-control":{medical_entry:["nurse"],medical_hub:["doctor"]}
  }};
  const front=png(64,64),worldSprite=png(9*16,32);
  for (const [group,ids] of [["world",names],["role",roles]]) {
    for(const name of ids) {
      const id=slug(name);
      const meta={
        name:group==="world"?name:"Class "+id,frames:9,frameWidth:16,frameHeight:32,
        battleFront:"battleFront.png",overworld:"overworld.png",
        battleFrontSha256:sha(front),overworldSha256:sha(worldSprite),
        identityMatch:group==="world"?"neutral-class-not-identity":"functional-role-archetype",
        provenance:{battleFront:"cooltrainer_m.png",overworld:"cooltrainer_m.png"}
      };
      if(group==="role")meta.displayRole=name;
      catalog[group==="world"?"worldEntrants":"roles"][id]=meta;
      const folder=join(dir,"files",group,id);
      await mkdir(folder,{recursive:true});
      await writeFile(join(folder,"battleFront.png"),front);
      await writeFile(join(folder,"overworld.png"),worldSprite);
    }
  }
  const bytes=Buffer.from(JSON.stringify(catalog));
  await writeFile(join(dir,"catalog.json"),bytes);
  return {dir,registry,catalog,pin:sha(bytes)};
}

test("release archive and catalog have non-placeholder immutable SHA-256 pins",()=>{
  assert.match(NPC_SECONDARY_ZIP_SHA256,/^[a-f0-9]{64}$/);
  assert.match(NPC_SECONDARY_CATALOG_SHA256,/^[a-f0-9]{64}$/);
  assert.notEqual(NPC_SECONDARY_CATALOG_SHA256,"0".repeat(64));
});

test("18 remaining canonical World entrants and 24 sober scene roles are validated",async t=>{
  const f=await fixture(t);
  assert.deepEqual(validateSecondaryCatalog(f.catalog,f.registry),{world:18,functionalRoles:24,png:84});
  assert.equal(f.catalog.worldEntrants.lucinda.identityMatch,"neutral-class-not-identity");
  assert.ok(f.catalog.worldEntrants.brendan);
  assert.equal(Object.keys(f.catalog.roles).length,24);
});

test("all 84 real local fixture PNGs must be SHA approved and in correct roles",async t=>{
  const f=await fixture(t);
  const actual=await verifyOfflineSecondaryNpcAssets(f.registry,f.dir,f.pin);
  assert.equal(actual.valid,true);
  assert.equal(actual.expected,84);
  assert.equal(actual.verified,84);
  assert.deepEqual(actual.missing,[]);
  assert.ok(await readVerifiedSecondaryNpcSprite("world","alder","battleFront",actual.available,join(f.dir,"files")));
  assert.ok(await readVerifiedSecondaryNpcSprite("role","referee","overworld",actual.available,join(f.dir,"files")));
});

test("corrupt, missing, unknown or path traversal sources fail without substitute sprites",async t=>{
  const f=await fixture(t);
  await unlink(join(f.dir,"files/world/alder/battleFront.png"));
  await writeFile(join(f.dir,"files/role/nurse/overworld.png"),png(32,32));
  const report=await verifyOfflineSecondaryNpcAssets(f.registry,f.dir,f.pin);
  assert.equal(report.valid,false);
  assert.equal(report.verified,82);
  assert.ok(report.missing.includes("world/alder/battleFront.png"));
  assert.ok(report.missing.includes("role/nurse/overworld.png"));
  assert.equal(await readVerifiedSecondaryNpcSprite("world","../alder","battleFront",report.available,join(f.dir,"files")),null);
  assert.equal(await readVerifiedSecondaryNpcSprite("role","swimmer","battleFront",report.available,join(f.dir,"files")),null);
  assert.equal(await readVerifiedSecondaryNpcSprite("role","nurse","world",report.available,join(f.dir,"files")),null);
});

test("unapproved catalog bytes are rejected; empty development setup advertises no NPC art",async t=>{
  const f=await fixture(t);
  await assert.rejects(verifyOfflineSecondaryNpcAssets(f.registry,f.dir),/not approved/);
  const none=await verifyOfflineSecondaryNpcAssets(f.registry,join(f.dir,"absent"));
  assert.equal(none.valid,false);
  assert.equal(none.verified,0);
  assert.equal(none.catalog,null);
});

test("world / functional art exposure follows encounter and exact scene node only",async t=>{
  const f=await fixture(t);
  const report=await verifyOfflineSecondaryNpcAssets(f.registry,f.dir,f.pin);
  assert.equal(npcWorldSpriteId(report,"Alder"),"alder");
  assert.equal(npcWorldSpriteId(report,"alder"),"alder");
  assert.equal(npcWorldSpriteId(report,"Unregistered Champion"),null);
  assert.deepEqual(npcSceneRoles(report,"m08-medical-control","medical_entry"),
    [{id:"nurse",label:"nurse",frames:9}]);
  assert.deepEqual(npcSceneRoles(report,"m08-medical-control","unrelated_node"),[]);
  assert.deepEqual(npcSceneRoles(report,"future-scene","medical_entry"),[]);
});

test("prohibited gimmick class and false identity are always rejected",async t=>{
  const f=await fixture(t);
  f.catalog.roles.nurse.provenance.battleFront="swimmer_m.png";
  assert.throws(()=>validateSecondaryCatalog(f.catalog,f.registry),/Prohibited/);
  f.catalog.roles.nurse.provenance.battleFront="nurse.png";
  f.catalog.roles.nurse.identityMatch="canon-specific";
  assert.throws(()=>validateSecondaryCatalog(f.catalog,f.registry),/cannot impersonate/);
});

test("mobile and UI integrate only local validated NPC sources",async()=>{
  const builder=await readFile(new URL("../mobile/build.mjs",import.meta.url),"utf8");
  const server=await readFile(new URL("../ui/server.mjs",import.meta.url),"utf8");
  const ui=await readFile(new URL("../ui/public/app.mjs",import.meta.url),"utf8");
  const info=await readFile(new URL("../ui/public/information-renderers.mjs",import.meta.url),"utf8");
  assert.match(builder,/verifyOfflineSecondaryNpcAssets/);
  assert.match(builder,/P5E_NPC_SECONDARY_OVERLAY_ZIP/);
  assert.match(builder,/secondarySprites/);
  assert.match(server,/serveSecondaryNpcSprite/);
  assert.match(server,/npcSceneRoles/);
  assert.match(ui,/sceneNpcArt/);
  assert.match(ui,/npc-sprites\/world/);
  assert.match(info,/npc-sprites\/world/);
});
