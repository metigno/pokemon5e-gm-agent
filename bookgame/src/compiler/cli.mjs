import { fileURLToPath } from "node:url";
import { compileStory, StoryCompileError, writeStoryBundle } from "./story-compiler.mjs";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const scenesDir = fileURLToPath(new URL("../../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../../content/modules/", import.meta.url));
const eventsDir = fileURLToPath(new URL("../../content/events/", import.meta.url));
const defaultOutput = fileURLToPath(new URL("../../build/story.bundle.json", import.meta.url));
const checkOnly = process.argv.includes("--check");
const reportOnly = process.argv.includes("--report");
const outputPath = argValue("--output") ?? defaultOutput;

function printModuleReport(bundle) {
  for (const [moduleId, metric] of Object.entries(bundle.index.modules)) {
    const stitchPct = (metric.stitchProgress * 100).toFixed(2);
    const choicePct = (metric.choiceProgress * 100).toFixed(2);
    console.log(
      moduleId + " " + metric.title +
      ": stitches " + metric.implementedStitches + "/" + metric.targetStitches + " (" + stitchPct + "%)" +
      ", choices " + metric.implementedChoices + "/" + metric.targetChoices + " (" + choicePct + "%)"
    );
  }
}

try {
  const bundle = await compileStory({ scenesDir, modulesDir, eventsDir });

  for (const warning of bundle.diagnostics.warnings) {
    console.warn("WARN " + warning.code + " " + warning.at + ": " + warning.message);
  }

  if (checkOnly || reportOnly) {
    console.log(
      "Story graph OK: " +
      bundle.index.sceneCount + " scene(s), " +
      bundle.index.nodeCount + " node(s), " +
      bundle.index.stitchCount + " stitch(es), " +
      bundle.index.choiceCount + " choice(s), " +
      bundle.index.worldEventCount + " world event(s)"
    );
    printModuleReport(bundle);
  } else {
    await writeStoryBundle(bundle, outputPath);
    console.log("Compiled offline story bundle: " + outputPath);
    console.log(
      bundle.index.sceneCount + " scene(s), " +
      bundle.index.nodeCount + " node(s), " +
      bundle.index.stitchCount + " stitch(es), " +
      bundle.index.choiceCount + " choice(s), " +
      bundle.index.worldEventCount + " world event(s)"
    );
    printModuleReport(bundle);
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
