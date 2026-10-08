import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPlayerRosterLimit, migrateGameState } from "./state.mjs";

const DEFAULT_DIR = fileURLToPath(new URL("../../local-saves/", import.meta.url));
export const CAREER_SLOTS = Object.freeze(["slot1", "slot2", "slot3"]);

function assertSlot(slot) {
  if (typeof slot !== "string" || !/^[a-z0-9_-]+$/i.test(slot)) {
    throw new Error("Invalid save slot");
  }
}

export function assertCareerSlot(slot) {
  if (!CAREER_SLOTS.includes(slot)) throw new Error("Seleziona uno dei tre slot di carriera.");
  return slot;
}

async function syncDirectory(dir) {
  // fsync on the directory also makes the rename/link durable on supported filesystems.
  // Some platforms (notably Windows) do not support opening/syncing directories.
  let handle;
  try {
    handle = await open(dir, "r");
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "EISDIR", "EPERM", "ENOTSUP", "EBADF"].includes(error.code)) throw error;
  } finally {
    await handle?.close();
  }
}

export class SaveStore {
  constructor(baseDir = DEFAULT_DIR) {
    this.baseDir = baseDir;
  }

  filePath(slot) {
    assertSlot(slot);
    return path.join(this.baseDir, `${slot}.json`);
  }

  async exists(slot) {
    try {
      await readFile(this.filePath(slot));
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async save(state, { createOnly = false } = {}) {
    assertSlot(state?.slot);
    assertPlayerRosterLimit(state);
    await mkdir(this.baseDir, { recursive: true });
    const target = this.filePath(state.slot);
    // Unique temporary filenames avoid competing writers sharing the same .tmp file.
    const temp = `${target}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temp, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      if (createOnly) {
        // link() fails with EEXIST and never replaces an existing career.
        await link(temp, target);
        await unlink(temp);
      } else {
        await rename(temp, target);
      }
      await syncDirectory(this.baseDir);
      return target;
    } finally {
      await handle?.close();
      await unlink(temp).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  async load(slot) {
    const parsed = JSON.parse(await readFile(this.filePath(slot), "utf8"));
    if (!parsed || parsed.slot !== slot) throw new Error("Save slot mismatch: file does not belong to this career");
    return migrateGameState(parsed);
  }

  async delete(slot) {
    await unlink(this.filePath(slot));
    await syncDirectory(this.baseDir);
  }

  async listCareers() {
    return Promise.all(CAREER_SLOTS.map(async (slot, index) => {
      try {
        const state = await this.load(slot);
        return {
          slot,
          number: index + 1,
          occupied: true,
          corrupted: false,
          protagonist: state.player?.name ?? "Trainer",
          trainerLevel: state.player?.trainerLevel ?? 1,
          moduleId: state.story?.sceneId ?? null,
          updatedAt: state.updatedAt ?? state.createdAt ?? null,
          careerEnded: state.player?.death?.state === "dead"
        };
      } catch (error) {
        if (error.code === "ENOENT") return { slot, number: index + 1, occupied: false, corrupted: false };
        // Never treat corrupted data as an empty slot: it must not be silently overwritten.
        return { slot, number: index + 1, occupied: true, corrupted: true };
      }
    }));
  }
}
