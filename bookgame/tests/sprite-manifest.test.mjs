import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateSpriteMap } from "../src/assets/sprite-runtime.mjs";

const map=JSON.parse(fs.readFileSync(new URL("../assets/pokemon/sprite-runtime-map.json",import.meta.url),"utf8"));

test("canonical sprite manifest contains the audited 619 non-Gmax entries",()=>{
  assert.equal(Object.keys(map.sprites).length,619);
  assert.equal(map.counts.sprites,619);
  assert.equal(map.counts.aliasCollisions,0);
  assert.equal(map.counts.aliases,639);
  assert.ok(!Object.keys(map.sprites).some(id=>/gmax|gigantamax/i.test(id)));
});

test("canonical sprite manifest passes runtime battle asset policy",()=>{
  const result=validateSpriteMap({ ...map, sprites:Object.fromEntries(Object.entries(map.sprites).map(([id,assets])=>[id,{assets}])) });
  assert.deepEqual(result.errors,[]);
  assert.equal(result.valid,true);
});

test("audited runtime aliases resolve key regional and Mega forms",()=>{
  assert.equal(map.aliasIndex["growlithe-hisuian"],"growlithe-hisui");
  assert.equal(map.aliasIndex["arcanine-hisuian"],"arcanine-hisui");
  assert.equal(map.aliasIndex["gengar-mega"],"mega-gengar");
  assert.equal(map.aliasIndex["excadrill-mega"],"mega-excadrill");
});
