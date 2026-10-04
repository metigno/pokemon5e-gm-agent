import { readFile } from "node:fs/promises";

const DEFAULT_BUNDLE = new URL("../../build/story.bundle.json", import.meta.url);

export class CompiledSceneRepository {
  constructor(bundle = DEFAULT_BUNDLE) {
    this.bundle = bundle;
    this.bundlePromise = null;
  }

  async loadBundle() {
    if (!this.bundlePromise) {
      this.bundlePromise = readFile(this.bundle, "utf8").then((content) => {
        const parsed = JSON.parse(content);
        if (parsed.format !== "p5e-librogame-story-bundle") {
          throw new Error("Invalid compiled story bundle format");
        }
        if (parsed.schemaVersion !== 1 || parsed.offline !== true) {
          throw new Error("Unsupported compiled story bundle");
        }
        if (!parsed.scenes || typeof parsed.scenes !== "object") {
          throw new Error("Compiled story bundle has no scenes");
        }
        return parsed;
      });
    }
    return this.bundlePromise;
  }

  async loadWorldEvents() {
    const bundle = await this.loadBundle();
    return structuredClone(bundle.worldEvents ?? []);
  }

  async load(sceneId) {
    if (!/^[A-Za-z0-9_-]+$/.test(sceneId)) {
      throw new Error("Invalid scene id: " + sceneId);
    }

    const bundle = await this.loadBundle();
    const scene = bundle.scenes[sceneId];
    if (!scene) throw new Error("Unknown compiled scene: " + sceneId);
    if (scene.id !== sceneId) {
      throw new Error("Compiled scene id mismatch: expected " + sceneId + ", got " + scene.id);
    }
    return structuredClone(scene);
  }
}
