import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIR = fileURLToPath(new URL("../../local-saves/", import.meta.url));

function assertSlot(slot) {
  if (!/^[a-z0-9_-]+$/i.test(slot)) throw new Error(`Invalid save slot: ${slot}`);
}

export class SaveStore {
  constructor(baseDir = DEFAULT_DIR) {
    this.baseDir = baseDir;
  }

  filePath(slot) {
    assertSlot(slot);
    return path.join(this.baseDir, `${slot}.json`);
  }

  async save(state) {
    assertSlot(state.slot);
    await mkdir(this.baseDir, { recursive: true });
    const target = this.filePath(state.slot);
    const temp = `${target}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temp, target);
    return target;
  }

  async load(slot) {
    return JSON.parse(await readFile(this.filePath(slot), "utf8"));
  }
}
