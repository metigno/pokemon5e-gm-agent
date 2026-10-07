import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { normalizeSpriteId } from "../src/assets/sprite-runtime.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { scaledHp } from "../src/combat/poke5e-rules.mjs";
import { CryptoDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState, EXPERIENCE_NEEDED_PER_LEVEL } from "../src/engine/state.mjs";
import { applyPlayerEvolution, playerEvolutionOptions } from "../src/engine/player-evolution.mjs";
import {
  applyPokemonAsiChoice,
  learnPokemonMove,
  resolvePendingPokemonLevelUp,
  resolvePokemonMoveReplacement
} from "../src/engine/pokemon-progression.mjs";
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
const poke5eData = new Poke5eDataRepository();
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

async function pokemonRosterView() {
  const roster = state?.player?.roster ?? (state?.player?.starter ? [state.player.starter] : []);
  return Promise.all(roster.map(async (pokemon, index) => {
    const species = await poke5eData.getSpecies(pokemon);
    const level = Number(pokemon.level ?? species.minLevel);
    const abilityId = pokemon.abilityId ?? species.abilities.find((entry) => !entry.hidden)?.id ?? species.abilities[0]?.id ?? null;
    const ability = abilityId ? await poke5eData.getAbility(abilityId) : null;
    const moveIds = Array.isArray(pokemon.moveIds)
      ? pokemon.moveIds
      : await poke5eData.getLevelMoveIds(species, level).then((ids) => ids.slice(-4));
    const moves = await Promise.all(moveIds.map(async (moveId) => {
      const move = await poke5eData.getMove(moveId);
      return {
        id: move.id,
        name: move.name,
        type: move.type,
        time: move.time,
        range: move.range,
        ppCurrent: Number.isFinite(pokemon.pp?.[move.id]) ? pokemon.pp[move.id] : move.pp,
        ppMax: move.pp
      };
    }));
    const maxHp = Number(pokemon.hp?.max ?? scaledHp(species, level));
    const currentHp = Number(pokemon.hp?.current ?? maxHp);
    const statuses = pokemon.statuses && typeof pokemon.statuses === "object"
      ? statusList({ statuses: pokemon.statuses })
      : Array.isArray(pokemon.conditions) ? pokemon.conditions : [];
    const nextLevelXp = level < 20 ? Number(EXPERIENCE_NEEDED_PER_LEVEL[level]) : null;

    return {
      index,
      nickname: pokemon.nickname ?? null,
      speciesId: species.id,
      name: species.name,
      form: pokemon.form ?? null,
      level,
      xp: Number.isFinite(pokemon.xp) ? pokemon.xp : null,
      nextLevelXp,
      sr: species.sr,
      size: species.size,
      types: structuredClone(pokemon.types ?? pokemon.type ?? species.type ?? []),
      ac: Number.isFinite(pokemon.ac) ? pokemon.ac : species.ac,
      hp: { current: currentHp, max: maxHp },
      attributes: structuredClone(pokemon.attributes ?? species.attributes ?? {}),
      savingThrows: structuredClone(pokemon.savingThrows ?? species.savingThrows ?? []),
      proficiencies: structuredClone(pokemon.proficiencies ?? species.skills ?? []),
      hitDice: structuredClone(pokemon.hitDice ?? { die: species.hitDice, current: level, max: level }),
      ability: ability ? { id: ability.id, name: ability.name, description: ability.description ?? null } : null,
      moves,
      statuses,
      bond: structuredClone(pokemon.bond ?? null),
      nature: pokemon.nature ?? null,
      gender: pokemon.gender ?? null,
      heldItemId: pokemon.heldItemId ?? pokemon.heldItem?.id ?? null,
      pendingMoveLearning: structuredClone(pokemon.pendingMoveLearning ?? []),
      pendingMoveChoices: structuredClone(pokemon.pendingMoveChoices ?? []),
      pendingAsiChoices: structuredClone(pokemon.pendingAsiChoices ?? []),
      pendingLevelUp: structuredClone(pokemon.pendingLevelUp ?? null),
      death: structuredClone(pokemon.death ?? null)
    };
  }));
}

function rosterPokemon(rosterIndex) {
  const index = Number(rosterIndex);
  if (!Number.isInteger(index) || index < 0) throw new Error("Indice Pokémon non valido");
  const roster = state?.player?.roster;
  if (!Array.isArray(roster) || !roster[index]) throw new Error("Pokémon non trovato nel roster");
  return { index, pokemon: roster[index] };
}

async function persistRosterPokemon(index, pokemon) {
  const next = structuredClone(state);
  next.player.roster[index] = structuredClone(pokemon);
  if (index === 0 && next.player.starter) next.player.starter = structuredClone(pokemon);
  await persist(next);
}

function pokemonProgressionContext() {
  return {
    inventory: structuredClone(state.player.inventory ?? []),
    money: Number(state.player.money ?? 0),
    timeOfDay: state.world?.time,
    world: structuredClone(state.world ?? {})
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
      roster: await pokemonRosterView()
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

  if (url.pathname === "/api/pokemon/level-up") {
    const { index, pokemon } = rosterPokemon(body.rosterIndex);
    const context = pokemonProgressionContext();
    const result = await resolvePendingPokemonLevelUp(pokemon, {
      evolutionId: body.evolutionId == null || body.evolutionId === "" ? null : String(body.evolutionId),
      declineEvolution: Boolean(body.declineEvolution),
      asiDistribution: body.asiDistribution ?? null,
      context,
      data: poke5eData
    });
    if (result.status === "choice_required" && result.choice?.type === "evolution_asi") {
      return sendJson(res, 200, { ok: true, progression: result, snapshot: await snapshot() });
    }
    await persistRosterPokemon(index, result.pokemon);
    if (result.context) {
      state.player.inventory = structuredClone(result.context.inventory ?? state.player.inventory ?? []);
      state.player.money = Number(result.context.money ?? state.player.money ?? 0);
      await persist(state);
    }
    return sendJson(res, 200, { ok: true, progression: result, snapshot: await snapshot() });
  }

  if (url.pathname === "/api/pokemon/learn-move") {
    const { index, pokemon } = rosterPokemon(body.rosterIndex);
    const moveId = String(body.moveId ?? "");
    if (!moveId) throw new Error("Move id richiesto");
    const next = learnPokemonMove(pokemon, moveId, {
      forgetMoveId: body.forgetMoveId == null || body.forgetMoveId === "" ? null : String(body.forgetMoveId)
    });
    await persistRosterPokemon(index, next);
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/pokemon/replace-move") {
    const { index, pokemon } = rosterPokemon(body.rosterIndex);
    const level = Number(body.level);
    const moveId = String(body.moveId ?? "");
    if (!Number.isInteger(level) || !moveId) throw new Error("Livello e move id richiesti");
    const next = resolvePokemonMoveReplacement(pokemon, level, moveId, {
      forgetMoveId: body.forgetMoveId == null || body.forgetMoveId === "" ? null : String(body.forgetMoveId)
    });
    await persistRosterPokemon(index, next);
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/pokemon/asi") {
    const { index, pokemon } = rosterPokemon(body.rosterIndex);
    const level = Number(body.level);
    if (!Number.isInteger(level)) throw new Error("Livello ASI richiesto");
    const next = applyPokemonAsiChoice(pokemon, level, body.distribution ?? {});
    await persistRosterPokemon(index, next);
    return sendJson(res, 200, await snapshot());
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
