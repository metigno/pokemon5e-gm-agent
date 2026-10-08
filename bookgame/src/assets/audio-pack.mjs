import { readFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const FILE_NAME = /^[a-z0-9_]+$/;
const REQUIRED_MUSIC = ["intro", "calm", "mystery", "danger", "evolution",
  "battle_wild", "battle_trainer", "battle_boss", "battle_legendary", "victory", "defeat",
  "pwt_final", "pwt_win", "pwt_victor",
  ...Array.from({ length: 12 }, (_, index) => "m" + String(index + 1).padStart(2, "0"))];

export async function verifyOfflineAudioAssets(audioDir) {
  const errors = [];
  let checked = 0;
  try {
    const manifest = JSON.parse(await readFile(join(audioDir, "manifest.json"), "utf8"));
    if (manifest.format !== "p5e-offline-audio-v1") throw Error("unknown audio pack format");
    if (REQUIRED_MUSIC.some(id => !manifest.music?.[id])) throw Error("missing required chapter or battle track");
    for (const kind of ["music", "effects", "cries"]) {
      if (typeof manifest[kind] !== "object" || manifest[kind] === null) throw Error("invalid section: " + kind);
      for (const [name, entry] of Object.entries(manifest[kind])) {
        if (!FILE_NAME.test(name)) throw Error("unsafe audio cue");
        const relative = kind === "cries" ? "cries/" + name + ".wav" : name + ".ogg";
        if (entry?.file !== "audio/" + relative || !/^[0-9a-f]{64}$/.test(entry.sha256) ||
            !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > 12 * 1024 * 1024)
          throw Error("invalid metadata for " + name);
        const path = join(audioDir, relative);
        try {
          const info = await lstat(path);
          if (!info.isFile() || info.isSymbolicLink() || info.size !== entry.bytes) throw Error("invalid size or type");
          const bytes = await readFile(path);
          if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
            throw Error("bad checksum");
          if (!bytes.subarray(0, 4).equals(Buffer.from(kind === "cries" ? "RIFF" : "OggS")))
            throw Error("invalid audio format");
          checked++;
        } catch (error) { errors.push(relative + ": " + error.message); }
      }
    }
  } catch (error) { errors.push(error.message); }
  return { valid: errors.length === 0, verified: checked, errors };
}
