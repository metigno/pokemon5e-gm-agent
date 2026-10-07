import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTextSpeed,
  revealDelayForCharacter,
  storyParagraphs,
  TEXT_SPEEDS
} from "../ui/public/reveal-model.mjs";

test("text speed defaults to normal and supports instant mode", () => {
  assert.equal(normalizeTextSpeed("fast"), "fast");
  assert.equal(normalizeTextSpeed("invalid"), "normal");
  assert.equal(TEXT_SPEEDS.normal, 32);
  assert.equal(revealDelayForCharacter("a", "instant"), 0);
});

test("punctuation produces a longer reveal pause than ordinary text", () => {
  assert.ok(revealDelayForCharacter(".", "normal") > revealDelayForCharacter("a", "normal"));
  assert.ok(revealDelayForCharacter(",", "normal") > revealDelayForCharacter("a", "normal"));
});

test("storyParagraphs preserves authored stitches", () => {
  const paragraphs = storyParagraphs({
    text: "fallback",
    stitches: [
      { id: "a", text: "Prima frase." },
      { id: "b", text: "Seconda frase." }
    ]
  });

  assert.deepEqual(paragraphs, ["Prima frase.", "Seconda frase."]);
});

test("storyParagraphs falls back to blank-line separated text", () => {
  assert.deepEqual(
    storyParagraphs({ text: "Uno.\n\nDue." }),
    ["Uno.", "Due."]
  );
});
