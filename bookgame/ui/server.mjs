import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { normalizeSpriteId } from "../src/assets/sprite-runtime.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { CryptoDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { applyPlayerEvolution, playerEvolutionOptions } from "../src/engine/player-evolution.mjs";
import {
  setTrainerGearEquipped,
  trainerGameplayView,
  usePlayerTrainerCombatFeature
} from "../src/engine/trainer-ui-runtime.mjs";

const HOST = process.env.P5E_UI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.P5E_UI_PORT ?? 4173);
const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));
const SPRITE_DIR = process.env.P5E_SPRITE_DIR ?? fileURLToPath(new URL("../assets/pokemon/files/", import.meta.url));
const spriteMap = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url), "utf8"));
const SPRITE_ROLES = new Set(["battleFront", "battleBack", "icon", "overworld"]);

const engine = new BookgameEngine();
const dice = new CryptoDice();
const combatEngine = new Pokemon5eCombatEngine({ dice });
const saves = new SaveStore(process.env.P5E_SAVE_DIR || undefined);

let state = null;

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/reveal-model.mjs", ["reveal-model.mjs", "text/javascript; charset=utf-8"]]
]);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, error, status = 400) {
  sendJson(res, status, {
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function persist(nextState) {
  state = nextState;
  await saves.save(state);
}

async function normalizeCombatFlow() {
  if (!state?.pending || state.pending.type !== "pokemon5e_combat") return;

  let battle = state.pending.battle;

  if (!battle) {
    battle = await combatEngine.createBattle(state.pending);
    await persist(engine.setCombatState(state, battle));
  }

  if (!battle.outcome && !battle.awaitingSwitch) {
    battle = await combatEngine.advanceToPlayerOrEnd(battle);
    await persist(engine.setCombatState(state, battle));
  }

  if (battle.outcome) {
    await persist(engine.resolveCombatHandoff(state, battle.outcome));
  }
}

function statusList(combatant) {
  if (!combatant?.statuses) return [];
  const result = [];
  if (combatant.statuses.nonVolatile) result.push(combatant.statuses.nonVolatile);
  if (combatant.statuses.flinchedTurns > 0) result.push("Flinched");
  return result;
}

async function battleView() {
  const battle = state?.pending?.battle;
  if (!battle) return null;

  const actor = combatEngine.actor(battle);
  const moves = actor === "player"
    ? await combatEngine.availablePlayerMoves(battle)
    : [];

  return {
    encounterId: battle.encounterId,
    round: battle.round,
    actor,
    awaitingSwitch: battle.awaitingSwitch,
    pendingTrainerReaction: battle.pendingTrainerReaction ?? null,
    initiative: battle.initiative,
    player: {
      name: battle.player.name,
      speciesId: battle.player.speciesId,
      level: battle.player.level,
      hp: battle.player.hp,
      ac: battle.player.ac,
      statuses: statusList(battle.player),
      movementRemaining: battle.player.turn?.movementRemaining ?? 0,
      actionAvailable: Boolean(battle.player.turn?.actionAvailable),
      bonusActionAvailable: Boolean(battle.player.turn?.bonusActionAvailable)
    },
    trainerActionAvailable: Boolean(battle.trainer?.actionAvailable),
    opponent: {
      name: battle.opponent.name,
      speciesId: battle.opponent.speciesId,
      level: battle.opponent.level,
      hp: battle.opponent.hp,
      ac: battle.opponent.ac,
      statuses: statusList(battle.opponent)
    },
    playerBench: (battle.playerBench ?? []).map((entry, index) => ({
      index,
      name: entry.name,
      speciesId: entry.speciesId,
      level: entry.level,
      hp: entry.hp,
      statuses: statusList(entry)
    })),
    moves: moves.map((move) => ({
      id: move.id,
      name: move.name,
      type: move.type,
      time: move.time,
      range: move.range,
      ppCurrent: battle.player.pp[move.id] ?? 0,
      ppMax: move.pp
    })),
    log: battle.log.slice(-14)
  };
}

async function evolutionView() {
  if (!state) return [];
  return playerEvolutionOptions(state);
}

async function snapshot() {
  if (!state) return { ok: true, hasSession: false };

  await normalizeCombatFlow();
  const story = await engine.present(state);

  return {
    ok: true,
    hasSession: true,
    story,
    player: {
      name: state.player.name,
      trainerClass: state.player.trainerClass,
      trainerLevel: state.player.trainerLevel,
      trainerPath: state.player.trainerPath,
      specializations: state.player.specializations ?? {},
      specializationDetails: state.player.specializationDetails ?? [],
      pokeslots: state.player.pokeslots,
      maxSr: state.player.maxSr,
      hp: state.player.hp,
      ac: state.player.ac,
      savingThrows: state.player.savingThrows ?? [],
      proficiencies: state.player.proficiencies ?? { skills: [], expertise: [] },
      classFeatures: state.player.classFeatures ?? [],
      conditions: state.player.conditions ?? [],
      abilities: state.player.abilities,
      skills: state.player.skills,
      money: state.player.money,
      inventory: state.player.inventory ?? [],
      roster: state.player.roster ?? [state.player.starter]
    },
    world: {
      day: state.world.day,
      time: state.world.time,
      minuteOfDay: state.world.minuteOfDay,
      locationId: state.world.locationId
    },
    evolutions: await evolutionView(),
    trainerGameplay: trainerGameplayView(
      state,
      state.pending?.battle ?? null,
      state.pending?.battle?.pendingTrainerReaction ?? null
    ),
    battle: await battleView()
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/snapshot") {
    return sendJson(res, 200, await snapshot());
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = await readJson(req);

  if (url.pathname === "/api/new-game") {
    const protagonist = String(body.protagonist ?? "Luke");
    const slot = String(body.slot ?? "slot1");
    await persist(createNewGameState({ protagonist, slot, startAtIntro: true }));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/load") {
    const slot = String(body.slot ?? "slot1");
    try {
      state = await saves.load(slot);
    } catch (error) {
      return sendError(res, new Error(`Salvataggio "${slot}" non trovato.`), 404);
    }
    return sendJson(res, 200, await snapshot());
  }

  if (!state) {
    return sendError(res, new Error("Nessuna partita attiva"), 409);
  }

  if (url.pathname === "/api/choose") {
    const choiceId = String(body.choiceId ?? "");
    await persist(await engine.choose(state, choiceId));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/evolution/apply") {
    const rosterIndex = Number(body.rosterIndex);
    const evolutionId = String(body.evolutionId ?? "");
    if (!evolutionId) throw new Error("Evolution id richiesto");
    const outcome = await applyPlayerEvolution(state, {
      rosterIndex,
      evolutionId,
      asiDistribution: body.asiDistribution ?? null,
      reducedMotion: Boolean(body.reducedMotion)
    });
    if (outcome.result.status === "choice_required") {
      return sendJson(res, 200, {
        ok: true,
        evolution: {
          result: outcome.result,
          presentation: null
        },
        snapshot: await snapshot()
      });
    }
    await persist(outcome.state);
    return sendJson(res, 200, {
      ok: true,
      evolution: {
        result: outcome.result,
        presentation: outcome.presentation
      },
      snapshot: await snapshot()
    });
  }

  if (url.pathname === "/api/trainer/gear") {
    const gearId = String(body.gearId ?? "");
    if (!gearId) throw new Error("Trainer Gear id richiesto");
    setTrainerGearEquipped(state, { gearId, equipped: Boolean(body.equipped) });
    await persist(state);
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/trainer-feature") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const featureId = String(body.featureId ?? "");
    if (!featureId) throw new Error("Trainer feature id richiesto");
    const resource = state.player.classResources?.["battle-dice"];
    const roll = featureId === "battle-master"
      ? dice.roll(Number(String(resource?.die ?? "d6").replace(/^d/i, "")))
      : null;
    const targetSide = featureId === "disciplined-strikes" ? "opponent" : "player";
    const outcome = usePlayerTrainerCombatFeature(state, state.pending.battle, {
      featureId,
      cost: body.cost == null ? null : Number(body.cost),
      mode: body.mode == null ? null : String(body.mode),
      targetSide,
      roll
    });
    if (!outcome.used) return sendJson(res, 409, { ok: false, error: outcome.reason });
    await persist(engine.setCombatState(state, outcome.battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/trainer-reaction") {
    await normalizeCombatFlow();
    if (!state.pending?.battle?.pendingTrainerReaction) throw new Error("Nessuna reaction Trainer in attesa");
    const pending = state.pending.battle.pendingTrainerReaction;
    let battle = state.pending.battle;
    if (body.useReaction) {
      const outcome = usePlayerTrainerCombatFeature(state, battle, {
        featureId: pending.featureId,
        cost: body.cost == null ? null : Number(body.cost),
        mode: pending.mode,
        targetSide: pending.targetSide,
        reactionContext: pending
      });
      if (!outcome.used) return sendJson(res, 409, { ok: false, error: outcome.reason });
      battle = outcome.battle;
    }
    battle = await combatEngine.resolvePendingTrainerReaction(battle, {
      useReaction: Boolean(body.useReaction)
    });
    await persist(engine.setCombatState(state, battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/item") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const itemId = String(body.itemId ?? "");
    if (!itemId) throw new Error("Item id richiesto");
    const outcome = await combatEngine.useTrainerItem(state.pending.battle, itemId, {
      targetSide: body.targetSide == null ? "player" : String(body.targetSide),
      moveId: body.moveId == null || body.moveId === "" ? null : String(body.moveId)
    });
    if (!outcome.result.applied) {
      return sendJson(res, 409, { ok: false, error: outcome.result.reason });
    }
    state.player.inventory = structuredClone(outcome.battle.trainer.inventory ?? []);
    await persist(engine.setCombatState(state, outcome.battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/move") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const battle = await combatEngine.usePlayerMove(state.pending.battle, String(body.moveId ?? ""));
    await persist(engine.setCombatState(state, battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/end-turn") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const battle = await combatEngine.endPlayerTurn(state.pending.battle);
    await persist(engine.setCombatState(state, battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/switch") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const battle = await combatEngine.switchPlayer(state.pending.battle, Number(body.benchIndex));
    await persist(engine.setCombatState(state, battle));
    return sendJson(res, 200, await snapshot());
  }

  return sendJson(res, 404, { ok: false, error: "API route not found" });
}

async function serveSprite(res, pathname) {
  const match = pathname.match(/^\/sprites\/([^/]+)\/(battleFront|battleBack|icon|overworld)$/);
  if (!match) return false;

  const requestedId = decodeURIComponent(match[1]);
  const role = match[2];
  if (!SPRITE_ROLES.has(role)) return false;

  const normalized = normalizeSpriteId(requestedId);
  const spriteId = spriteMap.aliasIndex?.[normalized] ?? normalized;
  const asset = spriteMap.sprites?.[spriteId]?.[role];
  if (!asset) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Sprite asset not found");
    return true;
  }

  try {
    const content = await readFile(join(SPRITE_DIR, spriteId, asset));
    res.writeHead(200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Sprite file missing");
  }
  return true;
}

async function serveStatic(res, pathname) {
  const entry = STATIC_FILES.get(pathname);
  if (!entry) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const [fileName, contentType] = entry;
  const content = await readFile(new URL(`./public/${fileName}`, import.meta.url));
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(content);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname.startsWith("/sprites/") && await serveSprite(res, url.pathname)) return;
    await serveStatic(res, url.pathname);
  } catch (error) {
    sendError(res, error, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pokémon 5e Bookgame UI: http://${HOST}:${PORT}`);
  console.log("Offline local UI — Ctrl+C per chiudere.");
});
