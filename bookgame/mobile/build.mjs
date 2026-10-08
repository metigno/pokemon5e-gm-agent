#!/usr/bin/env node
// Build an immutable, self-contained runtime inside the native app.
// NEVER produce a shippable dist tree when mandatory physical assets are missing.
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifyOfflineSpriteAssets } from "../scripts/verify-offline-sprites.mjs";
import { verifyOfflineCharacterSprites } from "../scripts/verify-offline-character-sprites.mjs";
import { verifyOfflineNativeCharacterSprites } from "../src/assets/native-character-sprites.mjs";
import { verifyOfflineSecondaryNpcAssets } from "../src/assets/npc-secondary-assets.mjs";
import { verifyOfflineAudioAssets } from "../src/assets/audio-pack.mjs";
import { APPROVED_MAP_ILLUSTRATION_IDS, APPROVED_MAP_SVG_IDS } from "../src/assets/map-illustrations.mjs";

const MOBILE = dirname(fileURLToPath(import.meta.url));
const BOOKGAME = dirname(MOBILE);
const OUT = join(MOBILE, "dist");
const RUNTIME_DIRS = ["src", "content", "data", "assets", "ui", "build", "scripts"];
const REQUIRED = [
  "src/engine/bookgame-engine.mjs",
  "src/combat/combat-engine.mjs",
  "src/engine/save-store.mjs",
  "src/combat/poke5e-data.mjs",
  "src/engine/compiled-scene-repository.mjs",
  "content/npcs/NPC_CHARACTER_LIBRARY_V1.json",
  "data/poke5e/2024/species.json",
  "data/poke5e/2024/moves.json",
  "assets/pokemon/sprite-runtime-map.json",
  "assets/characters/sha256.json",
  "assets/characters/native-sprites.json",
  "ui/server.mjs",
  "ui/public/index.html",
  "ui/public/app.mjs",
  "ui/public/styles.css"
];
const json = async (relative, root = BOOKGAME) => JSON.parse(await readFile(join(root, relative), "utf8"));

async function assertNoSymlinks(root) {
  const info = await lstat(root);
  if (info.isSymbolicLink()) throw new Error("Refusing symlink in mobile payload: " + root);
  if (info.isDirectory()) {
    for (const entry of await readdir(root)) await assertNoSymlinks(join(root, entry));
  }
}

async function contract() {
  for (const relative of REQUIRED) {
    if (!(await lstat(join(BOOKGAME, relative))).isFile()) {
      throw new Error("Missing canonical runtime input: " + relative);
    }
  }
  const config = JSON.parse(await readFile(join(MOBILE, "capacitor.config.json"), "utf8"));
  if (config.server?.url || config.server?.hostname ||
      config.plugins?.Nodejs?.nodeDir !== "nodejs" ||
      config.plugins?.Nodejs?.startMode !== "manual") {
    throw new Error("Mobile host must use embedded Node.js, never an external server URL");
  }
  if (!config.server.allowNavigation?.length ||
      config.server.allowNavigation.some(host => host !== "127.0.0.1")) {
    throw new Error("Only the in-app loopback host may be navigated to");
  }
  const packageManifest = JSON.parse(await readFile(join(MOBILE, "package.json"), "utf8"));
  if (!packageManifest.dependencies["@capawesome/capacitor-nodejs"]) {
    throw new Error("Embedded native Node.js runtime dependency missing");
  }
}

async function verifyMandatoryAssets(root = BOOKGAME) {
  const map = await json("assets/pokemon/sprite-runtime-map.json", root);
  const spriteDir = join(root, "assets/pokemon/files");
  const sprite = await verifyOfflineSpriteAssets(map, spriteDir);
  if (!sprite.valid) {
    throw new Error(`Mobile release BLOCKED: Pokémon sprites ${sprite.verifiedPng} verified; ${sprite.missing.length} missing, ${sprite.invalid.length} invalid (619 species required).`);
  }

  const registry = await json("content/npcs/NPC_CHARACTER_LIBRARY_V1.json", root);
  const checksums = await json("assets/characters/sha256.json", root);
  const nativeManifest = await json("assets/characters/native-sprites.json", root);
  const charDir = join(root, "assets/characters/files");
  const characters = await verifyOfflineCharacterSprites(registry, charDir, checksums);
  const native = await verifyOfflineNativeCharacterSprites(registry, nativeManifest, charDir);
  if (!characters.valid || !native.valid) {
    throw new Error(`Mobile release BLOCKED: Trainer sprites ${characters.verified}/${characters.expected} portraits, ${native.verified}/${native.expected} native sprites. No placeholders allowed.`);
  }
  const secondary = await verifyOfflineSecondaryNpcAssets(registry, join(root, "assets/npc-sprites"));
  if (!secondary.valid) {
    throw new Error(`Mobile release BLOCKED: secondary NPC sprites ${secondary.verified}/${secondary.expected} (18 World entrants + 24 functional roles). No network fallback.`);
  }

  // Map visuals do not invent new locations. Every approved physical visual must ship.
  const mapDir = join(root, "assets/maps/illustrations");
  for (const [ids, ext] of [[APPROVED_MAP_ILLUSTRATION_IDS, ".png"], [APPROVED_MAP_SVG_IDS, ".svg"]]) {
    for (const id of ids) {
      const path = join(mapDir, id + ext);
      const bytes = await readFile(path);
      if (!bytes.length || (ext === ".png" && !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) {
        throw new Error("Mobile release BLOCKED: invalid map illustration " + id + ext);
      }
    }
  }

  // This APK ships its soundtrack locally; never compile a silent or incomplete release.
  const audio = await verifyOfflineAudioAssets(join(root, "ui/public/audio"));
  if (!audio.valid) {
    throw new Error("Mobile release BLOCKED: missing or invalid offline music pack. "
      + "Run npm --prefix bookgame run audio:import -- /path/to/P5E_AudioPack_Mobile_MP3.zip and audio:verify. "
      + audio.errors.slice(0, 3).join("; "));
  }
  return { pokemon: sprite.verifiedPng, portraits: characters.verified,
    nativeSprites: native.verified, secondarySprites: secondary.verified, audio: audio.verified };
}

function compileStory() {
  const result = spawnSync(process.execPath, ["src/compiler/cli.mjs"], {
    cwd: BOOKGAME, stdio: "inherit"
  });
  if (result.status !== 0) throw new Error("Canonical story compiler failed");
}

async function assertBundle() {
  const bundle = await json("build/story.bundle.json");
  if (bundle.format !== "p5e-librogame-story-bundle" || bundle.schemaVersion !== 1 ||
      bundle.offline !== true || !Object.keys(bundle.scenes ?? {}).length) {
    throw new Error("Invalid offline compiled story bundle");
  }
}

function importOfflineTrainerOverlay(archive) {
  if (!archive) return;
  // Explicit local input only: do not download approved art or silently substitute it.
  const result = spawnSync("python3", ["scripts/install-trainer-overlay.py", "--zip", resolve(archive)], {
    cwd: BOOKGAME, stdio: "inherit"
  });
  if (result.status !== 0) throw new Error("Approved local Trainer ZIP import failed");
}

function importSecondaryNpcOverlay(archive) {
  if (!archive) return;
  const result = spawnSync("python3", ["scripts/install-secondary-npc-overlay.py", "--zip", resolve(archive)], {
    cwd: BOOKGAME, stdio: "inherit"
  });
  if (result.status !== 0) throw new Error("Approved secondary NPC ZIP import failed");
}

async function build(trainerZip = null, secondaryZip = null) {
  await contract();
  importOfflineTrainerOverlay(trainerZip);
  importSecondaryNpcOverlay(secondaryZip);
  compileStory();
  await assertBundle();
  const report = await verifyMandatoryAssets();
  for (const dir of RUNTIME_DIRS) await assertNoSymlinks(join(BOOKGAME, dir));

  const stage = await mkdtemp(join(MOBILE, ".dist-stage-"));
  try {
    const nodeRoot = join(stage, "nodejs");
    const target = join(nodeRoot, "bookgame");
    await mkdir(target, { recursive: true });
    for (const directory of RUNTIME_DIRS) {
      await cp(join(BOOKGAME, directory), join(target, directory), { recursive: true, force: false });
    }
    // Recheck the ACTUAL bytes shipped in the Android payload, not only source files.
    // A copied or mutated PNG must fail before dist/ is published.
    const shipped = await verifyMandatoryAssets(target);
    if (shipped.pokemon !== report.pokemon || shipped.portraits !== report.portraits ||
        shipped.nativeSprites !== report.nativeSprites ||
        shipped.secondarySprites !== report.secondarySprites || shipped.audio !== report.audio) {
      throw new Error("Packaged offline asset counts do not match verified sources");
    }
    // Canonical engine imports ../../../src/bridge from bookgame/src/engine.
    // Preserve that relative path inside the embedded Node.js project root.
    await mkdir(join(nodeRoot, "src"), { recursive: true });
    await cp(join(dirname(BOOKGAME), "src/bridge"), join(nodeRoot, "src/bridge"), { recursive: true, force: false });
    const smoke = spawnSync(process.execPath, ["--input-type=module", "-e",
      "await import('./bookgame/src/engine/bookgame-engine.mjs')"],
      { cwd: nodeRoot, encoding: "utf8" });
    if (smoke.status !== 0) {
      throw new Error("Embedded engine import smoke test failed: " + smoke.stderr);
    }
    await cp(join(MOBILE, "runtime/index.cjs"), join(nodeRoot, "index.cjs"));
    await writeFile(join(nodeRoot, "package.json"),
      JSON.stringify({ name: "p5e-embedded-runtime", version: "0.1.0", private: true, main: "index.cjs" }));
    await cp(join(MOBILE, "src/index.html"), join(stage, "index.html"));
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [join(MOBILE, "src/bootstrap.mjs")], bundle: true, platform: "browser",
      target: "es2022", format: "esm", minify: true, outfile: join(stage, "bootstrap.mjs")
    });
    await rm(OUT, { recursive: true, force: true });
    await rename(stage, OUT);
    console.log("Offline mobile assets packaged:", JSON.stringify(report));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
const command = process.argv[2] ?? "--package";
if (command === "--contract") {
  await contract();
  console.log("Mobile offline host contract: PASS (physical asset coverage not tested)");
} else if (command === "--package") {
  const args = process.argv.slice(3);
  const paths = {};
  if (args.length % 2) throw new Error("Offline assets must be supplied as --option path pairs");
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], file = args[i + 1];
    if (!["--characters-zip", "--secondary-npcs-zip"].includes(flag) || !file || paths[flag]) {
      throw new Error("Invalid or duplicate offline sprite archive flag");
    }
    paths[flag] = file;
  }
  await build(paths["--characters-zip"] ?? process.env.P5E_TRAINER_OVERLAY_ZIP ?? null,
    paths["--secondary-npcs-zip"] ?? process.env.P5E_NPC_SECONDARY_OVERLAY_ZIP ?? null);
} else {
  throw new Error("Usage: build.mjs [--contract|--package [--characters-zip path] [--secondary-npcs-zip path]]");
}
