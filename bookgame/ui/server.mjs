import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { CryptoDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const HOST = process.env.P5E_UI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.P5E_UI_PORT ?? 4173);
const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));

const engine = new BookgameEngine();
const combatEngine = new Pokemon5eCombatEngine({ dice: new CryptoDice() });
const saves = new SaveStore();

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
      trainerLevel: state.player.trainerLevel,
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
    await serveStatic(res, url.pathname);
  } catch (error) {
    sendError(res, error, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pokémon 5e Bookgame UI: http://${HOST}:${PORT}`);
  console.log("Offline local UI — Ctrl+C per chiudere.");
});
