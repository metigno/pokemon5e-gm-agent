import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { CompiledSceneRepository } from "../src/engine/compiled-scene-repository.mjs";
import { compileStory, validateScene, writeStoryBundle } from "../src/compiler/story-compiler.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));

test("current authored scenes compile into an offline deterministic bundle", async () => {
  const first = await compileStory({ scenesDir });
  const second = await compileStory({ scenesDir });

  assert.equal(first.format, "p5e-librogame-story-bundle");
  assert.equal(first.offline, true);
  assert.ok(first.index.sceneIds.includes("first-road"));
  assert.ok(first.index.sceneIds.includes("m01-release"));
  assert.ok(first.index.nodeCount >= 1);
  assert.deepEqual(second, first);
});

test("compiled bundle can drive the existing BookgameEngine without network services", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-story-compiler-"));
  try {
    const bundle = await compileStory({ scenesDir });
    const output = path.join(dir, "story.bundle.json");
    await writeStoryBundle(bundle, output);

    const scenes = new CompiledSceneRepository(output);
    const engine = new BookgameEngine({ scenes });
    const state = createNewGameState({ protagonist: "Luke" });
    const view = await engine.present(state);

    assert.equal(view.sceneId, "m01-release");
    assert.equal(view.nodeId, "free_roam");
    assert.ok(view.choices.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects a goto pointing to a missing node", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "broken-scene",
    title: "Broken",
    locationId: "test",
    nodes: {
      start: {
        text: "Start",
        choices: [
          { id: "go", text: "Go", goto: "missing" }
        ]
      }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((entry) => entry.code === "MISSING_TARGET"));
});

test("validator rejects duplicate choice ids and malformed check definitions", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "broken-check",
    title: "Broken check",
    locationId: "test",
    nodes: {
      start: {
        text: "Start",
        choices: [
          { id: "same", text: "One", goto: "end" },
          {
            id: "same",
            text: "Two",
            check: { ability: "LUCK", skill: "Animal Handling", dc: 0 },
            outcomes: {
              success: { goto: "end" },
              failure: { goto: "end" }
            }
          }
        ]
      },
      end: {
        text: "End",
        choices: []
      }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((entry) => entry.code === "DUPLICATE_CHOICE_ID"));
  assert.ok(report.errors.some((entry) => entry.code === "INVALID_ABILITY"));
  assert.ok(report.errors.some((entry) => entry.code === "INVALID_DC"));
});
