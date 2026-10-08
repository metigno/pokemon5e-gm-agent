import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { normalizeSpriteId } from "../src/assets/sprite-runtime.mjs";
import { APPROVED_MAP_ILLUSTRATION_IDS, APPROVED_MAP_SVG_IDS } from "../src/assets/map-illustrations.mjs";
import { verifyOfflineSpriteAssets } from "../scripts/verify-offline-sprites.mjs";
import { verifyOfflineCharacterSprites } from "../scripts/verify-offline-character-sprites.mjs";
import { loadAvailableCharacterPortraits, readVerifiedCharacterPortrait } from "../src/assets/character-portraits.mjs";
import { verifyOfflineNativeCharacterSprites, readVerifiedNativeCharacterSprite } from "../src/assets/native-character-sprites.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { buildTravelMap } from "../src/engine/map-view.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { captureBallsInInventory } from "../src/combat/capture.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { distance, movementSpeedForType, withinLineOfSightDistance } from "../src/combat/spatial.mjs";
import { scaledHp } from "../src/combat/poke5e-rules.mjs";
import { CryptoDice } from "../src/engine/dice.mjs";
import { SaveStore, assertCareerSlot } from "../src/engine/save-store.mjs";
import { trainerCareerEnded } from "../src/engine/trainer-survival.mjs";
import { createNewGameState, EXPERIENCE_NEEDED_PER_LEVEL } from "../src/engine/state.mjs";
import { informationPanelsView } from "../src/engine/information-panels.mjs";
import { getQuestJournal } from "../src/engine/quest-state.mjs";
import { pokemonLevelCapForState } from "../src/engine/pokemon-xp-balance.mjs";
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
const MAP_ART_DIR = fileURLToPath(new URL("../assets/maps/illustrations/", import.meta.url));
const spriteMap = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url), "utf8"));
const SPRITE_ROLES = new Set(["battleFront", "battleBack", "icon", "overworld"]);
const CHARACTER_DIR = process.env.P5E_CHARACTER_SPRITE_DIR ?? fileURLToPath(new URL("../assets/characters/files/", import.meta.url));
const characterRegistry = JSON.parse(await readFile(new URL("../content/npcs/NPC_CHARACTER_LIBRARY_V1.json", import.meta.url), "utf8"));
const characterChecksums = JSON.parse(await readFile(new URL("../assets/characters/sha256.json", import.meta.url), "utf8"));
const characterPortraits = await loadAvailableCharacterPortraits(characterRegistry, characterChecksums, CHARACTER_DIR);
const nativeCharacterManifest = JSON.parse(await readFile(new URL("../assets/characters/native-sprites.json", import.meta.url), "utf8"));
const nativeCharacterReport = await verifyOfflineNativeCharacterSprites(characterRegistry, nativeCharacterManifest, CHARACTER_DIR);
const availableNativeCharacters = nativeCharacterReport.available;
if (process.env.P5E_REQUIRE_OFFLINE_CHARACTERS === "1") {
  const report = await verifyOfflineCharacterSprites(characterRegistry, CHARACTER_DIR, characterChecksums);
  if (!report.valid) throw new Error(`Offline character portraits incomplete: ${report.verified}/${report.expected} verified, ${report.missing.length} missing, ${report.unapproved.length} unapproved. Never ship an incomplete set.`);
  if (!nativeCharacterReport.valid) throw new Error(`Offline native character sprites incomplete: ${nativeCharacterReport.verified}/${nativeCharacterReport.expected} battle/overworld PNGs verified.`);
}

// Packaged releases refuse to run if even one mapped physical PNG is missing.
if (process.env.P5E_REQUIRE_OFFLINE_SPRITES === "1") {
  const report = await verifyOfflineSpriteAssets(spriteMap, SPRITE_DIR);
  if (!report.valid) {
    throw new Error(`Offline sprite release incomplete: ${report.verifiedPng} valid PNG, ${report.missing.length} missing, ${report.invalid.length} invalid; expected 619 mapped species. Run sprites:verify before shipping.`);
  }
}

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
  ["/reveal-model.mjs", ["reveal-model.mjs", "text/javascript; charset=utf-8"]],
  ["/information-renderers.mjs", ["information-renderers.mjs", "text/javascript; charset=utf-8"]]
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
  // Keep the old in-memory snapshot if disk persistence fails.
  await saves.save(nextState);
  state = nextState;
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
    await persist(await engine.resolveCombatHandoffWithXp(state, battle.outcome, { data: poke5eData }));
  }
}

function statusList(combatant) {
  if (!combatant?.statuses) return [];
  const result = [];
  if (combatant.statuses.nonVolatile) result.push(combatant.statuses.nonVolatile);
  if (combatant.statuses.flinchedTurns > 0) result.push("Flinched");
  return result;
}

// The engine owns legality; this projection only exposes the resources and
// selections required to play its existing spatial actions on touch screens.
function activeSwitchAllowed(battle) {
  if (combatEngine.actor(battle) !== "player" || battle.pendingTrainerReaction) return false;
  if (!battle.player.turn?.actionAvailable || !battle.trainer?.actionAvailable) return false;
  if (!(battle.playerBench ?? []).some((pokemon) => pokemon.hp.current > 0)) return false;
  if ((battle.player.effects?.switchLockSources ?? []).some((entry) =>
    entry.expiresRound == null || battle.round < entry.expiresRound
  )) return false;
  return withinLineOfSightDistance(battle.trainer.position, battle.player.position, 60);
}

function validDestination(value) {
  return value && typeof value === "object" &&
    Number.isFinite(value.x) && Number.isFinite(value.y) &&
    (value.z === undefined || Number.isFinite(value.z));
}

async function opponentOpportunityMove(battle) {
  if (!battle.opponent.reactionAvailable) return null;
  for (const id of battle.opponent.moveIds ?? []) {
    if ((battle.opponent.pp?.[id] ?? 0) <= 0) continue;
    const move = await poke5eData.getMove(id);
    if (move.time?.unit === "action" && move.range?.type === "melee" && move.attack) return id;
  }
  return null;
}

async function battleView() {
  const battle = state?.pending?.battle;
  if (!battle) return null;

  const actor = combatEngine.actor(battle);
  const moves = actor === "player"
    ? await combatEngine.availablePlayerMoves(battle)
    : [];
  const canAct = actor === "player" && !battle.awaitingSwitch && !battle.pendingTrainerReaction;
  const movementModes = canAct
    ? (battle.player.speed ?? []).map(({ type }) => ({
      type,
      remaining: Math.max(0, movementSpeedForType(battle.player, type, battle.round).value -
        Number(battle.player.turn?.movementSpent ?? 0))
    })).filter(({ remaining }) => remaining > 0)
    : [];

  return {
    encounterId: battle.encounterId,
    opponentTrainerId: battle.opponentTrainerId ?? null,
    opponentTrainerLevel: battle.opponentTrainerLevel ?? null,
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
      position: battle.player.position,
      disengaged: Boolean(battle.player.turn?.disengaged),
      movementRemaining: battle.player.turn?.movementRemaining ?? 0,
      actionAvailable: Boolean(battle.player.turn?.actionAvailable),
      bonusActionAvailable: Boolean(battle.player.turn?.bonusActionAvailable)
    },
    trainerActionAvailable: Boolean(battle.trainer?.actionAvailable),
    spatial: {
      trainerPosition: battle.trainer.position,
      opponentPosition: battle.opponent.position,
      distance: battle.player.position && battle.opponent.position
        ? distance(battle.player.position, battle.opponent.position) : null,
      pokemonMovementModes: movementModes,
      trainerMovementRemaining: canAct ? Number(battle.trainer.movementRemaining ?? 0) : 0,
      disengageAvailable: canAct && Boolean(battle.player.turn?.actionAvailable),
      voluntarySwitchAvailable: activeSwitchAllowed(battle)
    },
    capture: {
      available: actor === "player" &&
        !battle.awaitingSwitch && !battle.pendingTrainerReaction &&
        !battle.opponentRegistered &&
        Boolean(battle.trainer?.actionAvailable) &&
        Boolean(battle.player?.turn?.actionAvailable),
      balls: battle.opponentRegistered ? [] : captureBallsInInventory(battle.trainer?.inventory ?? [])
    },
    flee: {
      available: actor === "player" &&
        !battle.awaitingSwitch && !battle.pendingTrainerReaction &&
        !battle.opponentRegistered &&
        battle.flee?.lastAttemptRound !== battle.round
    },
    opponent: {
      name: battle.opponent.name,
      speciesId: battle.opponent.speciesId,
      level: battle.opponent.level,
      hp: battle.opponent.hp,
      ac: battle.opponent.ac,
      statuses: statusList(battle.opponent),
      position: battle.opponent.position
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
    const moveName = async (moveId) => {
      try { return (await poke5eData.getMove(moveId)).name; }
      catch { return String(moveId ?? "").replace(/[-_]/g, " "); }
    };
    const pendingMoveLearning = await Promise.all((pokemon.pendingMoveLearning ?? []).map(async (entry) => ({
      ...structuredClone(entry),
      moveName: await moveName(entry.moveId)
    })));
    const pendingMoveChoices = await Promise.all((pokemon.pendingMoveChoices ?? []).map(async (entry) => ({
      ...structuredClone(entry),
      availableMoves: await Promise.all((entry.availableMoveIds ?? []).map(async (id) => ({
        id,
        name: await moveName(id)
      })))
    })));

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
      pendingMoveLearning,
      pendingMoveChoices,
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

  if (!trainerCareerEnded(state)) await normalizeCombatFlow();
  const ended = trainerCareerEnded(state);
  const story = ended
    ? {
        sceneId: "career-ended",
        sceneTitle: "Carriera conclusa",
        moduleId: null,
        nodeId: "finale",
        text: "Il Trainer è morto. Questa carriera è conclusa definitivamente. Puoi conservare il ricordo del viaggio o iniziare una nuova partita in un altro slot.",
        stitches: null,
        choices: [],
        questJournal: getQuestJournal(state),
        worldTime: null,
        pending: null,
        lastRoll: null
      }
    : await engine.present(state);

  const information = informationPanelsView(state);
  const battle = await battleView();
  const knownNames = new Set((information.people ?? []).map(person => person.name));
  const currentOpponent = battle?.opponentTrainerId;
  const visibleNativeCharacters = Object.fromEntries(
    Object.entries(availableNativeCharacters).filter(([id]) =>
      knownNames.has(characterRegistry.five.find(c => c.id === id)?.name ?? id) ||
      knownNames.has(characterRegistry.moduleAnchors.find(c => c.id === id)?.name ?? id) ||
      knownNames.has(characterRegistry.verifiedAdditionalCharacters.find(c => c.id === id)?.name ?? id) ||
      id === currentOpponent
    ).map(([id, asset]) => [id, { frames: asset.frames }])
  );
  return {
    ok: true,
    hasSession: true,
    slot: state.slot,
    careerEnded: ended,
    story,
    map: buildTravelMap(state, story),
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
    information,
    assets: { characterPortraits: Object.fromEntries((information.people ?? [])
      .map(person => [person.name, characterPortraits.byName[person.name]])
      .filter(([, id]) => Boolean(id))), characterNative: visibleNativeCharacters },
    evolutions: await evolutionView(),
    trainerGameplay: trainerGameplayView(
      state,
      state.pending?.battle ?? null,
      state.pending?.battle?.pendingTrainerReaction ?? null
    ),
    battle
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/snapshot") {
    return sendJson(res, 200, await snapshot());
  }
  if (req.method === "GET" && url.pathname === "/api/slots") {
    return sendJson(res, 200, { ok: true, slots: await saves.listCareers(), activeSlot: state?.slot ?? null });
  }
  if (req.method === "GET" && url.pathname === "/api/slot-hall") {
    const slot = assertCareerSlot(url.searchParams.get("slot"));
    try {
      // Read a selected career without changing the currently loaded session.
      const saved = await saves.load(slot);
      return sendJson(res, 200, { ok: true, entries: informationPanelsView(saved).hallOfFame });
    } catch (error) {
      if (error.code === "ENOENT") return sendJson(res, 200, { ok: true, entries: [] });
      return sendError(res, new Error("Impossibile consultare la Hall of Fame di questo slot."), 422);
    }
  }


  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = await readJson(req);

  if (url.pathname === "/api/new-game") {
    const protagonist = String(body.protagonist ?? "Luke");
    const slot = assertCareerSlot(body.slot ?? "slot1");
    const occupied = await saves.exists(slot);
    if (occupied && body.confirmOverwrite !== true) {
      return sendError(res, new Error("Questo slot contiene già una carriera. Conferma la sovrascrittura per ricominciare."), 409);
    }
    const next = createNewGameState({ protagonist, slot, startAtIntro: true });
    await saves.save(next, { createOnly: !occupied });
    state = next;
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/load") {
    const slot = assertCareerSlot(body.slot ?? "slot1");
    try {
      const loaded = await saves.load(slot);
      state = loaded;
    } catch (error) {
      if (error.code === "ENOENT") return sendError(res, new Error("Nessuna carriera salvata in questo slot."), 404);
      return sendError(res, new Error("Questo salvataggio non può essere letto. Non è stato sovrascritto."), 422);
    }
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/delete-slot") {
    const slot = assertCareerSlot(body.slot);
    if (body.confirmDelete !== true) return sendError(res, new Error("Conferma l'eliminazione permanente della carriera."), 409);
    try {
      await saves.delete(slot);
    } catch (error) {
      if (error.code === "ENOENT") return sendError(res, new Error("Questo slot è già vuoto."), 404);
      throw error;
    }
    if (state?.slot === slot) state = null;
    return sendJson(res, 200, { ok: true, slots: await saves.listCareers() });
  }

  if (url.pathname === "/api/leave") {
    state = null; // All changes are saved before the API responds to each action.
    return sendJson(res, 200, { ok: true, hasSession: false });
  }

  if (!state) {
    return sendError(res, new Error("Nessuna partita attiva"), 409);
  }

  // Prevent a stale browser tab from mutating the career selected in another tab.
  const expectedSlot = req.headers["x-career-slot"] ?? body.expectedSlot;
  if (expectedSlot != null && expectedSlot !== state.slot) {
    return sendError(res, new Error("È stata aperta un'altra carriera. Torna alla selezione degli slot."), 409);
  }

  if (url.pathname === "/api/save") {
    await persist(state);
    return sendJson(res, 200, { ok: true, slot: state.slot });
  }

  if (trainerCareerEnded(state)) {
    return sendError(res, new Error("Carriera conclusa: non puoi più compiere azioni."), 409);
  }

  if (state.pending?.type === "pokemon_capture_replacement" && url.pathname !== "/api/choose") {
    return sendError(res, new Error("Prima scegli quale Pokémon liberare"), 409);
  }

  if (url.pathname === "/api/choose") {
    const choiceId = String(body.choiceId ?? "");
    await persist(await engine.choose(state, choiceId));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/evolution/apply") {
    if (state.pending?.type === "pokemon5e_combat") {
      return sendError(res, new Error("Evoluzione non disponibile durante il combattimento"), 409);
    }
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

  if (url.pathname.startsWith("/api/pokemon/")) {
    if (state.pending?.type === "pokemon5e_combat") {
      return sendError(res, new Error("Progressione Pokémon non disponibile durante il combattimento"), 409);
    }
  }

  if (url.pathname === "/api/pokemon/level-up") {
    const { index, pokemon } = rosterPokemon(body.rosterIndex);
    const context = pokemonProgressionContext();
    const result = await resolvePendingPokemonLevelUp(pokemon, {
      evolutionId: body.evolutionId == null || body.evolutionId === "" ? null : String(body.evolutionId),
      declineEvolution: Boolean(body.declineEvolution),
      asiDistribution: body.asiDistribution ?? null,
      context,
      data: poke5eData,
      maxLevel: pokemonLevelCapForState(state)
    });
    if (result.status === "choice_required" && result.choice?.type === "evolution_asi") {
      return sendJson(res, 200, { ok: true, progression: result, snapshot: await snapshot() });
    }
    const nextState = structuredClone(state);
    nextState.player.roster[index] = structuredClone(result.pokemon);
    if (index === 0 && nextState.player.starter) {
      nextState.player.starter = structuredClone(result.pokemon);
    }
    if (result.context) {
      nextState.player.inventory = structuredClone(result.context.inventory ?? nextState.player.inventory ?? []);
      nextState.player.money = Number(result.context.money ?? nextState.player.money ?? 0);
    }
    await persist(nextState);
    return sendJson(res, 200, { ok: true, progression: result, snapshot: await snapshot() });
  }

  if (url.pathname === "/api/pokemon/learn-move") {
    const { index, pokemon } = rosterPokemon(body.rosterIndex);
    const moveId = String(body.moveId ?? "");
    if (!moveId) throw new Error("Move id richiesto");
    if (!(pokemon.pendingMoveLearning ?? []).some((entry) => entry.moveId === moveId)) {
      return sendError(res, new Error("Nessun apprendimento pendente per questa mossa"), 409);
    }
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

  if (url.pathname === "/api/combat/flee") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    if (state.pending.battle.opponentRegistered) {
      return sendJson(res, 409, { ok: false, error: "Non puoi fuggire da una partita ufficiale" });
    }
    const outcome = await combatEngine.attemptPlayerFlee(state.pending.battle);
    await persist(engine.setCombatState(state, outcome.battle));
    if (!outcome.result.legal) {
      return sendJson(res, 409, { ok: false, error: outcome.result.reason ?? "Fuga non consentita" });
    }
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/capture") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const ball = String(body.ball ?? "pokeball");
    const outcome = await combatEngine.attemptPlayerCapture(state.pending.battle, ball);
    if (!outcome.result.legal) {
      return sendJson(res, 409, { ok: false, error: outcome.result.reason ?? "Cattura non consentita" });
    }
    const next = engine.setCombatState(state, outcome.battle);
    next.player.inventory = structuredClone(outcome.battle.trainer.inventory ?? []);
    await persist(next);
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/disengage") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    const battle = await combatEngine.useDisengage(state.pending.battle, "player");
    await persist(engine.setCombatState(state, battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/movement") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    if (!validDestination(body.destination)) {
      return sendError(res, new Error("Coordinate non valide: servono x e y numerici, z opzionale"), 400);
    }
    if (state.pending.battle.awaitingSwitch || state.pending.battle.pendingTrainerReaction ||
        combatEngine.actor(state.pending.battle) !== "player") {
      return sendError(res, new Error("Non puoi muoverti in questo momento"), 409);
    }
    let battle;
    if (body.unit === "pokemon") {
      const mode = String(body.movementType ?? "");
      if (!(state.pending.battle.player.speed ?? []).some((entry) => entry.type === mode)) {
        return sendError(res, new Error("Modalità di movimento non disponibile"), 409);
      }
      battle = await combatEngine.moveCombatant(state.pending.battle, "player", body.destination, {
        movementType: mode,
        opportunityMoveId: await opponentOpportunityMove(state.pending.battle)
      });
    } else if (body.unit === "trainer") {
      battle = await combatEngine.moveTrainer(state.pending.battle, body.destination);
    } else {
      return sendError(res, new Error("Unità di movimento non valida"), 400);
    }
    await persist(engine.setCombatState(state, battle));
    return sendJson(res, 200, await snapshot());
  }

  if (url.pathname === "/api/combat/move") {
    await normalizeCombatFlow();
    if (!state.pending?.battle) throw new Error("Nessun combattimento attivo");
    if (body.targetPoint != null && !validDestination(body.targetPoint)) {
      return sendError(res, new Error("Punto bersaglio non valido"), 400);
    }
    if (body.targetSide != null && !["player", "opponent"].includes(body.targetSide)) {
      return sendError(res, new Error("Bersaglio non valido"), 400);
    }
    const battle = await combatEngine.usePlayerMove(state.pending.battle, String(body.moveId ?? ""), {
      targetPoint: body.targetPoint ?? null,
      targetSide: body.targetSide ?? null,
      canonicalChoice: body.canonicalChoice ?? null
    });
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
    if (body.releasePosition != null && !validDestination(body.releasePosition)) {
      return sendError(res, new Error("Posizione di ingresso non valida"), 400);
    }
    const battle = await combatEngine.switchPlayer(state.pending.battle, Number(body.benchIndex), {
      releasePosition: body.releasePosition ?? null
    });
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

async function serveMapIllustration(res, pathname) {
  if (!pathname.startsWith("/map-art/")) return false;
  const filename = pathname.slice("/map-art/".length);
  const extension = filename.endsWith(".png") ? "png" : filename.endsWith(".svg") ? "svg" : null;
  const id = extension ? filename.slice(0, -(extension.length + 1)) : null;
  const approved = extension === "png" ? APPROVED_MAP_ILLUSTRATION_IDS : APPROVED_MAP_SVG_IDS;
  if (!id || filename !== id + "." + extension || !approved.has(id)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Map illustration not found");
    return true;
  }
  try {
    const image = await readFile(join(MAP_ART_DIR, filename));
    res.writeHead(200, { "content-type": extension === "svg" ? "image/svg+xml; charset=utf-8" : "image/png", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
    res.end(image);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Map illustration missing");
  }
  return true;
}

async function serveCharacterPortrait(res, pathname) {
  const match = pathname.match(/^\/characters\/([A-Za-z][A-Za-z0-9]*)\/(portrait|battleFront|overworld)$/);
  if (!match) return false;
  const bytes = match[2] === "portrait"
    ? await readVerifiedCharacterPortrait(match[1], characterPortraits, CHARACTER_DIR)
    : await readVerifiedNativeCharacterSprite(match[1], match[2], availableNativeCharacters, CHARACTER_DIR);
  if (!bytes) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Verified character portrait unavailable");
    return true;
  }
  res.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" });
  res.end(bytes);
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

// Serialize API operations, including snapshot combat handoffs and slot switches.
 // This prevents two concurrent actions from overwriting each other's save.
let apiQueue = Promise.resolve();
function serialApi(operation) {
  const next = apiQueue.then(operation, operation);
  apiQueue = next.catch(() => {});
  return next;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
    if (url.pathname.startsWith("/api/")) {
      await serialApi(() => handleApi(req, res, url));
      return;
    }
    if (url.pathname.startsWith("/sprites/") && await serveSprite(res, url.pathname)) return;
    if (url.pathname.startsWith("/characters/") && await serveCharacterPortrait(res, url.pathname)) return;
    if (await serveMapIllustration(res, url.pathname)) return;
    await serveStatic(res, url.pathname);
  } catch (error) {
    sendError(res, error, /slot di carriera/.test(error?.message ?? "") ? 400 : 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pokémon 5e Bookgame UI: http://${HOST}:${PORT}`);
  console.log("Offline local UI — Ctrl+C per chiudere.");
});
