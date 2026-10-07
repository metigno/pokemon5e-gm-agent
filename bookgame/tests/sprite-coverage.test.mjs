import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSpriteId, validateCanonicalSpriteCoverage } from "../src/assets/sprite-coverage.mjs";

test("canonical species spellings normalize to sprite IDs",()=>{
 assert.equal(canonicalSpriteId("Hisuian Growlithe"),"growlithe-hisui");
 assert.equal(canonicalSpriteId("Arcanine-Hisui"),"arcanine-hisui");
 assert.equal(canonicalSpriteId("Mega Gengar"),"mega-gengar");
 assert.equal(canonicalSpriteId("Rotom-W"),"rotom-wash");
});
test("Gigantamax references are rejected rather than silently mapped",()=>{
 assert.throws(()=>canonicalSpriteId("Gmax Charizard"),/Gigantamax/);
});
test("all structured M01-M12 Pokemon references have canonical sprite coverage",()=>{
 const result=validateCanonicalSpriteCoverage();
 assert.deepEqual(result.forbidden,[]);
 assert.deepEqual(result.missing,[]);
 assert.equal(result.valid,true);
});
