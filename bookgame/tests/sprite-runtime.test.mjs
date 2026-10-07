import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSpriteId, validateSpriteMap } from "../src/assets/sprite-runtime.mjs";

test("regional and Mega forms normalize to canonical sprite IDs", () => {
  assert.equal(normalizeSpriteId("Growlithe", "Hisuian"), "growlithe-hisui");
  assert.equal(normalizeSpriteId("Gengar", "Mega"), "mega-gengar");
});

test("Gigantamax is rejected by Bookgame sprite policy", () => {
  assert.throws(() => normalizeSpriteId("Charizard", "Gmax"), /Gigantamax/);
});

test("sprite map requires battle front, back and icon but not overworld", () => {
  const result=validateSpriteMap({
    format:"p5e-librogame-sprite-runtime-map",
    sprites:{ shinx:{assets:{battleFront:"front.png",battleBack:"back.png",icon:"icon.png",overworld:null}} }
  });
  assert.equal(result.valid,true);
});
