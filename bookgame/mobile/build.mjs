#!/usr/bin/env node
// Build an immutable, self-contained runtime inside the native app.
// NEVER produce a shippable dist tree when mandatory physical assets are missing.
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifyOfflineSpriteAssets } from "../scripts/verify-offline-sprites.mjs";
import { verifyOfflineCharacterSprites } from "../scripts/verify-offline-character-sprites.mjs";
import { verifyOfflineNativeCharacterSprites } from "../src/assets/native-character-sprites.mjs";
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
const json = async relative => JSON.parse(await readFile(join(BOOKGAME, relative), "utf8"));

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

async function verifyMandatoryAssets() {
  const map = await json("assets/pokemon/sprite-runtime-map.json");
  const spriteDir = join(BOOKGAME, "assets/pokemon/files");
  const sprite = await verifyOfflineSpriteAssets(map, spriteDir);
  if (!sprite.valid) {
    throw new Error(`Mobile release BLOCKED: Pokémon sprites ${sprite.verifiedPng} verified; ${sprite.missing.length} missing, ${sprite.invalid.length} invalid (619 species required).`);
  }

  const registry = await json("content/npcs/NPC_CHARACTER_LIBRARY_V1.json");
  const checksums = await json("assets/characters/sha256.json");
  const nativeManifest = await json("assets/characters/native-sprites.json");
  const charDir = join(BOOKGAME, "assets/characters/files");
  const characters = await verifyOfflineCharacterSprites(registry, charDir, checksums);
  const native = await verifyOfflineNativeCharacterSprites(registry, nativeManifest, charDir);
  if (!characters.valid || !native.valid) {
    throw new Error(`Mobile release BLOCKED: Trainer sprites ${characters.verified}/${characters.expected} portraits, ${native.verified}/${native.expected} native sprites. No placeholders allowed.`);
  }

  // Map visuals do not invent new locations. Every approved physical visual must ship.
  const mapDir = join(BOOKGAME, "assets/maps/illustrations");
  for (const [ids, ext] of [[APPROVED_MAP_ILLUSTRATION_IDS, ".png"], [APPROVED_MAP_SVG_IDS, ".svg"]]) {
    for (const id of ids) {
      const path = join(mapDir, id + ext);
      const bytes = await readFile(path);
      if (!bytes.length || (ext === ".png" && !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) {
        throw new Error("Mobile release BLOCKED: invalid map illustration " + id + ext);
      }
    }
  }

  // Music is an optional separately licensed pack. If installed, verify every byte.
  let audio = false;
  const manifest = join(BOOKGAME, "ui/public/audio/manifest.json");
  try {
    await lstat(manifest);
    audio = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (audio) {
    const report = await verifyOfflineAudioAssets(dirname(manifest));
    if (!report.valid) throw new Error("Mobile release BLOCKED: offline audio " + report.errors.slice(0, 3).join("; "));
  }
  return { pokemon: sprite.verifiedPng, portraits: characters.verified, nativeSprites: native.verified, audio };
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

async function build() {
  await contract();
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
    await cp(join(MOBILE, "runtime/index.cjs"), join(nodeRoot, "index.cjs"));
    await writeFile(join(nodeRoot, "package.json"),
      JSON.stringify({ name: "p5e-embedded-runtime", version: "0.1.0", private: true, main: "index.cjs" }));
    await cp(join(MOBILE, "src/index.html"), join(stage, "index.html"));
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [join(MOBILE, "src/bootstrap.mjs")], bundle: true, platform: "browser",
      target: "es2020", format: "esm", minify: true, outfile: join(stage, "bootstrap.mjs")
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
  await build();
} else {
  throw new Error("Usage: node bookgame/mobile/build.mjs [--contract|--package]");
}
