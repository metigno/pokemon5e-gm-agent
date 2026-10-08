import { readFile } from "node:fs/promises";
import { CompiledSceneRepository } from "./compiled-scene-repository.mjs";

const DEFAULT_ROOT = new URL("../../content/scenes/", import.meta.url);

export class SceneRepository {
  constructor(root = DEFAULT_ROOT, compiled = new CompiledSceneRepository()) {
    this.root = root;
    this.compiled = compiled;
  }

  // Keep authored scene loading unchanged. Runtime-wide catalogs come from the
  // same validated offline bundle produced by compile:story.
  async loadWorldEvents() {
    return this.compiled.loadWorldEvents();
  }

  async loadEcology() {
    return this.compiled.loadEcology();
  }

  async load(sceneId) {
    if (!/^[a-z0-9-]+$/i.test(sceneId)) throw new Error(`Invalid scene id: ${sceneId}`);
    const url = new URL(`${sceneId}.json`, this.root);
    const scene = JSON.parse(await readFile(url, "utf8"));
    if (scene.id !== sceneId) {
      throw new Error(`Scene id mismatch: expected ${sceneId}, got ${scene.id}`);
    }
    if (!scene.nodes || typeof scene.nodes !== "object") {
      throw new Error(`Scene ${sceneId} has no nodes`);
    }
    return scene;
  }
}
