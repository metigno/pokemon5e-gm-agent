import { fileURLToPath } from "node:url";
import { compileStory, StoryCompileError, writeStoryBundle } from "./story-compiler.mjs";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const scenesDir = fileURLToPath(new URL("../../content/scenes/", import.meta.url));
const defaultOutput = fileURLToPath(new URL("../../build/story.bundle.json", import.meta.url));
const checkOnly = process.argv.includes("--check");
const outputPath = argValue("--output") ?? defaultOutput;

try {
  const bundle = await compileStory({ scenesDir });

  for (const warning of bundle.diagnostics.warnings) {
    console.warn("WARN " + warning.code + " " + warning.at + ": " + warning.message);
  }

  if (checkOnly) {
    console.log(
      "Story graph OK: " +
      bundle.index.sceneCount + " scene(s), " +
      bundle.index.nodeCount + " node(s), " +
      bundle.index.choiceCount + " choice(s)"
    );
  } else {
    await writeStoryBundle(bundle, outputPath);
    console.log("Compiled offline story bundle: " + outputPath);
    console.log(
      bundle.index.sceneCount + " scene(s), " +
      bundle.index.nodeCount + " node(s), " +
      bundle.index.choiceCount + " choice(s)"
    );
  }
} catch (error) {
  if (error instanceof StoryCompileError) {
    for (const diagnostic of error.diagnostics) {
      console.error("ERROR " + diagnostic.code + " " + diagnostic.at + ": " + diagnostic.message);
    }
  } else {
    console.error(error.stack ?? error.message ?? String(error));
  }
  process.exitCode = 1;
}
