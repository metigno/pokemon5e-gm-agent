import {
  normalizeTextSpeed,
  revealDelayForCharacter,
  storyParagraphs
} from "/reveal-model.mjs";
import { informationRenderers } from "/information-renderers.mjs";

const $ = (selector) => document.querySelector(selector);

const els = {
  appShell: $(".app-shell"),
  appAlert: $("#app-alert"),
  sceneTitle: $("#scene-title"),
  moduleLabel: $("#module-label"),
  worldDay: $("#world-day"),
  worldTime: $("#world-time"),
  locationLabel: $("#location-label"),
  storyScreen: $("#story-screen"),
  battleScreen: $("#battle-screen"),
  storyText: $("#story-text"),
  storySpeaker: $("#story-speaker"),
  skipText: $("#skip-text"),
  revealHint: $("#reveal-hint"),
  lastRoll: $("#last-roll"),
  choiceList: $("#choice-list"),
  startScreen: $("#start-screen"),
  startError: $("#start-error"),
  protagonist: $("#protagonist"),
  slot: $("#slot"),
  slotStatus: $("#slot-status"),
  newGame: $("#new-game"),
  loadGame: $("#load-game"),
  deleteGame: $("#delete-game"),
  startCodex: $("#start-codex"),
  startHall: $("#start-hall"),
  referenceOverlay: $("#reference-overlay"),
  referenceTitle: $("#reference-title"),
  referenceContent: $("#reference-content"),
  referenceClose: $("#reference-close"),
  drawer: $("#drawer"),
  drawerBackdrop: $("#drawer-backdrop"),
  drawerTitle: $("#drawer-title"),
  drawerContent: $("#drawer-content"),
  closeDrawer: $("#close-drawer"),
  battleTitle: $("#battle-title"),
  battleRound: $("#battle-round"),
  enemyName: $("#enemy-name"),
  enemyLevel: $("#enemy-level"),
  enemyHpFill: $("#enemy-hp-fill"),
  enemyHpText: $("#enemy-hp-text"),
  enemySprite: $("#enemy-sprite"),
  opponentTrainerSprite: $("#opponent-trainer-sprite"),
  playerPokemonName: $("#player-pokemon-name"),
  playerPokemonLevel: $("#player-pokemon-level"),
  playerHpFill: $("#player-hp-fill"),
  playerHpText: $("#player-hp-text"),
  playerSprite: $("#player-sprite"),
  moveList: $("#move-list"),
  positionMeta: $("#battle-position-meta"),
  positionForm: $("#battle-position-form"),
  positionTitle: $("#battle-position-title"),
  positionMode: $("#battle-position-mode"),
  positionX: $("#battle-position-x"),
  positionY: $("#battle-position-y"),
  positionZ: $("#battle-position-z"),
  positionCancel: $("#battle-position-cancel"),
  endTurn: $("#end-turn"),
  combatLog: $("#combat-log"),
  choiceOverlay: $("#choice-overlay"),
  choiceTitle: $("#choice-dialog-title"),
  choiceDescription: $("#choice-dialog-description"),
  choiceOptions: $("#choice-dialog-options"),
  choiceCancel: $("#choice-dialog-cancel"),
  evolutionOverlay: $("#evolution-overlay"),
  evolutionStatus: $("#evolution-status"),
  evolutionFrom: $("#evolution-from"),
  evolutionTo: $("#evolution-to"),
  evolutionFromSprite: $("#evolution-from-sprite"),
  evolutionToSprite: $("#evolution-to-sprite")
};

let snapshot = null;
let careerSlots = [];
let revealRun = 0;
let revealActive = false;
let revealFinish = null;
let drawerReturnFocus = null;
let referenceReturnFocus = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const ATTRIBUTE_CHOICES = [
  ["str", "Forza"], ["dex", "Destrezza"], ["con", "Costituzione"],
  ["int", "Intelligenza"], ["wis", "Saggezza"], ["cha", "Carisma"]
];

function chooseTouchOption({ title, description = "", options }) {
  if (!options.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    const overlay = els.choiceOverlay;
    const oldFocus = document.activeElement;
    const background = [els.appShell, els.drawer, els.startScreen];
    const backgroundInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    els.choiceTitle.textContent = title;
    els.choiceDescription.textContent = description;
    els.choiceOptions.replaceChildren();
    overlay.hidden = false;

    const finish = (value) => {
      overlay.hidden = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.removeEventListener("click", onBackdrop);
      els.choiceCancel.removeEventListener("click", onCancel);
      els.choiceOptions.replaceChildren();
      background.forEach((element, index) => { element.inert = backgroundInert[index]; });
      if (oldFocus?.isConnected) oldFocus?.focus?.();
      else if (els.drawer.classList.contains("is-open")) els.closeDrawer.focus();
      resolve(value);
    };
    const onCancel = () => finish(null);
    const onBackdrop = (event) => { if (event.target === overlay) finish(null); };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      } else if (event.key === "Tab") {
        const buttons = [...overlay.querySelectorAll("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          buttons.at(-1)?.focus();
        } else if (!event.shiftKey && index === buttons.length - 1) {
          event.preventDefault();
          buttons[0]?.focus();
        }
      }
    };

    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-dialog-option";
      const name = document.createElement("span");
      name.textContent = option.label;
      button.append(name);
      if (option.detail) {
        const detail = document.createElement("small");
        detail.textContent = option.detail;
        button.append(detail);
      }
      button.addEventListener("click", () => finish(option.value), { once: true });
      els.choiceOptions.append(button);
    }
    els.choiceCancel.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeyDown);
    els.choiceOptions.querySelector("button")?.focus();
  });
}

async function chooseAsiDistribution(pokemon, points, title = "Migliora le caratteristiche", { maxScore = 20, maxPerStat = Infinity } = {}) {
  const total = Number(points);
  if (!Number.isInteger(total) || total <= 0) return null;
  const allocation = {};
  for (let remaining = total; remaining > 0; remaining--) {
    const options = ATTRIBUTE_CHOICES.map(([value, label]) => {
      const base = Number(pokemon?.attributes?.[value] ?? pokemon?.attributes?.[value.toUpperCase()] ?? 10);
      const allocated = allocation[value] ?? 0;
      return { value, label, score: base + allocated, allocated };
    }).filter((entry) => entry.score < maxScore && entry.allocated < maxPerStat)
      .map((entry) => ({ value: entry.value, label: entry.label, detail: `Valore attuale: ${entry.score}` }));
    if (!options.length) {
      showInlineError("Non ci sono caratteristiche che possono ricevere altri punti.");
      return null;
    }
    const stat = await chooseTouchOption({
      title,
      description: `Scegli dove assegnare 1 punto. Punti ancora da distribuire: ${remaining}.`,
      options
    });
    if (!stat) return null;
    allocation[stat] = (allocation[stat] ?? 0) + 1;
  }
  return allocation;
}

function pokemonDisplayName(pokemon, fallback = "Pokémon") {
  return pokemon?.nickname ?? pokemon?.name ?? pokemon?.speciesId ?? fallback;
}

async function chooseMoveToForget(pokemon) {
  return chooseTouchOption({
    title: `Quale mossa deve dimenticare ${pokemonDisplayName(pokemon)}?`,
    description: "Scegli una mossa da sostituire. Puoi annullare senza perdere nulla.",
    options: (pokemon?.moves ?? []).map((move) => ({
      value: move.id,
      label: move.name ?? playerFacingLabel(move.id),
      detail: `PP ${move.ppCurrent ?? "—"}/${move.ppMax ?? "—"}`
    }))
  });
}

async function api(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.method === "POST" && snapshot?.hasSession ? { "x-career-slot": snapshot.slot } : {}),
    ...options.headers
  };
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Errore HTTP ${response.status}`);
  }
  return payload;
}

function describeSlot(entry) {
  if (!entry?.occupied) return "Vuoto";
  if (entry.corrupted) return "Salvataggio illeggibile — non sovrascrivere senza volerlo";
  const level = entry.trainerLevel ?? 1;
  return `${entry.protagonist} · Trainer Lv.${level}${entry.careerEnded ? " · CARRIERA CONCLUSA" : ""}`;
}

function showSelectedSlot() {
  const selected = careerSlots.find((entry) => entry.slot === els.slot.value);
  els.slotStatus.textContent = selected ? describeSlot(selected) : "Caricamento dei salvataggi…";
  els.loadGame.disabled = !selected?.occupied || Boolean(selected.corrupted);
  els.deleteGame.disabled = !selected?.occupied;
}

async function refreshSlots() {
  const payload = await api("/api/slots");
  careerSlots = payload.slots;
  for (const option of els.slot.options) {
    const entry = careerSlots.find((slot) => slot.slot === option.value);
    option.textContent = `Slot ${entry?.number ?? "?"} — ${describeSlot(entry)}`;
  }
  showSelectedSlot();
}

function currentTextSpeed() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "instant";
  return normalizeTextSpeed(localStorage.getItem("p5e_text_speed") ?? "normal");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finishRevealNow() {
  if (typeof revealFinish === "function") revealFinish();
}

async function revealStory(story) {
  const run = ++revealRun;
  const paragraphs = storyParagraphs(story);
  const speed = currentTextSpeed();

  els.storyText.replaceChildren();
  els.choiceList.replaceChildren();
  els.choiceList.setAttribute("aria-hidden", "true");
  els.skipText.hidden = speed === "instant";
  els.revealHint.hidden = speed === "instant";
  revealActive = speed !== "instant";

  let forced = speed === "instant";
  revealFinish = () => { forced = true; };

  for (const paragraph of paragraphs) {
    if (run !== revealRun) return;
    const p = document.createElement("p");
    els.storyText.append(p);

    if (forced) {
      p.textContent = paragraph;
      continue;
    }

    const caret = document.createElement("span");
    caret.className = "reveal-caret";

    for (const character of paragraph) {
      if (run !== revealRun) return;
      if (forced) {
        p.textContent = paragraph;
        break;
      }
      p.append(character);
      p.append(caret);
      await delay(revealDelayForCharacter(character, speed));
      caret.remove();
    }

    if (!forced) await delay(95);
  }

  if (run !== revealRun) return;
  revealActive = false;
  revealFinish = null;
  els.skipText.hidden = true;
  els.revealHint.hidden = true;
  renderChoices(story.choices ?? []);
  if (els.drawer.dataset.panel === "map") openDrawer("map");
}

function renderChoices(choices) {
  els.choiceList.replaceChildren();

  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    const rollRequest = choice.save
      ? `TS ${choice.save.ability}`
      : choice.check
        ? `CT ${choice.check.skill ?? choice.check.ability}`
        : null;
    button.textContent = rollRequest ? `${choice.text} · ${rollRequest}` : choice.text;
    button.addEventListener("click", async () => {
      button.classList.add("is-selected");
      for (const node of els.choiceList.querySelectorAll("button")) node.disabled = true;
      try {
        snapshot = await api("/api/choose", {
          method: "POST",
          body: JSON.stringify({ choiceId: choice.id })
        });
        await renderSnapshot();
      } catch (error) {
        button.classList.remove("is-selected");
        for (const node of els.choiceList.querySelectorAll("button")) node.disabled = false;
        showInlineError(error.message);
      }
    });
    els.choiceList.append(button);
  }

  els.choiceList.setAttribute("aria-hidden", "false");
}

function showInlineError(message) {
  // Battle and Team live outside the story roll panel: errors must be visible everywhere.
  els.appAlert.textContent = String(message || "Operazione non riuscita.");
  els.appAlert.hidden = false;
}

function formatTime(world) {
  const minute = Number(world.minuteOfDay ?? 0);
  const hh = String(Math.floor(minute / 60) % 24).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${world.time ?? ""} · ${hh}:${mm}`;
}

function playerFacingLabel(value) {
  return String(value ?? "").replace(/[-_]/g, " ")
    .replace(/\b[a-zà-ÿ]/g, (letter) => letter.toUpperCase());
}

function renderHeader() {
  if (!snapshot?.hasSession) return;
  const title = String(snapshot.story.sceneTitle ?? "");
  els.sceneTitle.textContent = title
    .replace(/^M\d+[_-]\d+\s*[—:–-]\s*/i, "")
    .replace(/World Exit Branch/gi, "Il viaggio di ritorno") || "Il viaggio";
  const chapter = Number(String(snapshot.story.moduleId ?? "").replace(/\D/g, ""));
  els.moduleLabel.textContent = chapter ? `Capitolo ${chapter}` : "Il viaggio";
  els.worldDay.textContent = `Giorno ${snapshot.world.day}`;
  els.worldTime.textContent = formatTime(snapshot.world);
  const locationId = String(snapshot.world.locationId ?? "");
  els.locationLabel.textContent = locationId === "world_village"
    ? "Villaggio del Mondiale"
    : playerFacingLabel(locationId.replace(/_(city|town|village|gate|region|area)$/i, ""));
}

function renderRoll() {
  const roll = snapshot.story.lastRoll;
  if (!roll) {
    els.lastRoll.hidden = true;
    els.lastRoll.textContent = "";
    return;
  }
  els.lastRoll.hidden = false;
  els.lastRoll.textContent =
    `${roll.kind === "save" ? "TS" : "CT"} ${roll.skill ?? roll.ability ?? ""} · ${roll.notation ?? "d20"} — ${roll.passed ? "successo" : "fallimento"}`;
}

function spriteUrl(speciesId, role) {
  if (!speciesId) return "";
  return `/sprites/${encodeURIComponent(speciesId)}/${role}`;
}

function hpPercent(hp) {
  if (!hp?.max) return 0;
  return Math.max(0, Math.min(100, (hp.current / hp.max) * 100));
}

function formatLog(entry) {
  if (entry.type === "initiative") return "Iniziativa determinata.";
  if (entry.type === "turn_start") return `Inizia il turno: ${entry.actor}.`;
  if (entry.type === "attack" || entry.type === "opportunity_attack") {
    return `${entry.moveName ?? entry.moveId}: ${entry.hit ? `${entry.damage} danni` : "manca il bersaglio"}.`;
  }
  if (entry.type === "save_move") return `${entry.moveName ?? entry.moveId}: tiro salvezza risolto.`;
  if (entry.type === "status_damage") return `${entry.actor}: ${entry.damage} danni da ${entry.status}.`;
  if (entry.type === "fainted") return `${entry.actor} non è più in grado di combattere.`;
  if (entry.type === "capture_attempt") {
    return `${entry.ballId ?? "Poké Ball"}: ${entry.captured ? "cattura riuscita" : "il Pokémon è rimasto libero"}` +
      (Number.isFinite(entry.total) ? ` · ${entry.total} vs DC ${entry.dc}` : "") + ".";
  }
  if (entry.type === "flee_attempt") {
    return entry.escaped ? "Fuga riuscita." : "Tentativo di fuga non riuscito.";
  }
  if (entry.type === "combat_end") return `Combattimento concluso: ${entry.outcome}.`;
  if (entry.type === "switch") return `Cambio: ${entry.out} → ${entry.in}.`;
  if (entry.type === "movement") return `${entry.actor} si muove di ${Math.round(entry.feet)} ft.`;
  return entry.type.replaceAll("_", " ");
}

const POSITIONED_MOVES = new Set(["teleport", "smog", "poison-gas", "hail", "sandstorm", "smokescreen"]);
const ATTRIBUTE_MOVES = new Set(["power-shift", "power-split", "power-swap", "power-trick"]);
const ABILITY_LABELS = { str: "Forza", dex: "Destrezza", con: "Costituzione", int: "Intelligenza", wis: "Saggezza", cha: "Carisma" };

function formatPosition(position) {
  if (!position) return "—";
  return `(${position.x}, ${position.y}${position.z == null ? "" : `, ${position.z}`}) ft`;
}

function addBattleAction(title, detail, run) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "move-button";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = detail;
  button.append(strong, small);
  button.addEventListener("click", run);
  els.moveList.append(button);
}

function openBattlePositionForm(kind, options = {}) {
  const battle = snapshot?.battle;
  if (!battle) return;
  const initial = kind === "trainer" || kind === "switch"
    ? battle.spatial.trainerPosition : battle.player.position;
  els.positionForm.dataset.kind = kind;
  els.positionForm.dataset.benchIndex = options.benchIndex ?? "";
  els.positionForm.dataset.moveId = options.moveId ?? "";
  els.positionTitle.textContent = kind === "pokemon" ? "Destinazione Pokémon (ft)"
    : kind === "trainer" ? "Destinazione Trainer (ft)"
    : kind === "switch" ? "Punto di ingresso del Pokémon (entro 15 ft dal Trainer)"
    : "Centro o destinazione della mossa (ft)";
  els.positionX.value = String(initial.x);
  els.positionY.value = String(initial.y);
  els.positionZ.value = initial.z == null ? "" : String(initial.z);
  const moveModeLabel = els.positionMode.parentElement;
  moveModeLabel.hidden = kind !== "pokemon";
  els.positionMode.replaceChildren();
  if (kind === "pokemon") {
    for (const mode of battle.spatial.pokemonMovementModes) {
      const option = document.createElement("option");
      option.value = mode.type;
      option.textContent = `${mode.type} · ${mode.remaining} ft rimasti`;
      els.positionMode.append(option);
    }
  }
  els.positionForm.hidden = false;
  els.positionX.focus();
}

async function useBattleMove(move) {
  if (POSITIONED_MOVES.has(move.id)) {
    openBattlePositionForm("move", { moveId: move.id });
    return;
  }
  if (ATTRIBUTE_MOVES.has(move.id)) {
    const valid = move.id === "power-split" ? ["str", "dex", "wis"]
      : move.id === "power-trick" ? ["str", "dex", "int", "wis", "cha"]
      : ["str", "dex", "con", "int", "wis", "cha"];
    const chosen = await chooseTouchOption({
      title: `${move.name} — caratteristica`,
      options: valid.map((id) => ({ value: id, label: ABILITY_LABELS[id] }))
    });
    if (chosen) await runCombatAction("/api/combat/move", {
      moveId: move.id, canonicalChoice: { attribute: chosen }
    });
    return;
  }
  if (move.id === "psycho-shift") {
    const chosen = await chooseTouchOption({
      title: "Psycho Shift — origine dello stato",
      options: [
        { value: "player", label: "Il tuo Pokémon" },
        { value: "opponent", label: "Pokémon avversario" }
      ]
    });
    if (chosen) await runCombatAction("/api/combat/move", {
      moveId: move.id, canonicalChoice: { sourceSide: chosen }
    });
    return;
  }
  await runCombatAction("/api/combat/move", { moveId: move.id });
}

function renderBattle(battle) {
  els.storyScreen.hidden = true;
  els.battleScreen.hidden = false;
  els.battleTitle.textContent = battle.encounterId;
  const opponentId = battle.opponentTrainerId;
  const hasTrainerArt = Boolean(opponentId && snapshot?.assets?.characterNative?.[opponentId]);
  els.opponentTrainerSprite.hidden = !hasTrainerArt;
  if (hasTrainerArt) els.opponentTrainerSprite.src = `/characters/${encodeURIComponent(opponentId)}/battleFront`;
  else els.opponentTrainerSprite.removeAttribute("src");
  els.battleRound.textContent = `Round ${battle.round}`;

  els.enemyName.textContent = battle.opponent.name;
  els.enemySprite.src = spriteUrl(battle.opponent.speciesId, "battleFront");
  els.enemyLevel.textContent = `Lv. ${battle.opponent.level}`;
  els.enemyHpFill.style.width = `${hpPercent(battle.opponent.hp)}%`;
  els.enemyHpText.textContent =
    `HP ${battle.opponent.hp.current}/${battle.opponent.hp.max} · AC ${battle.opponent.ac}` +
    (battle.opponent.statuses.length ? ` · ${battle.opponent.statuses.join(", ")}` : "");

  els.playerPokemonName.textContent = battle.player.name;
  els.playerSprite.src = spriteUrl(battle.player.speciesId, "battleBack");
  els.playerPokemonLevel.textContent = `Lv. ${battle.player.level}`;
  els.playerHpFill.style.width = `${hpPercent(battle.player.hp)}%`;
  els.playerHpText.textContent =
    `HP ${battle.player.hp.current}/${battle.player.hp.max} · AC ${battle.player.ac}` +
    (battle.player.statuses.length ? ` · ${battle.player.statuses.join(", ")}` : "");

  els.moveList.replaceChildren();
  els.positionForm.hidden = true;
  const spatial = battle.spatial;
  els.positionMeta.textContent = spatial
    ? `Pokémon ${formatPosition(battle.player.position)} · Nemico ${formatPosition(spatial.opponentPosition)}
Distanza ${spatial.distance == null ? "—" : spatial.distance.toFixed(1)} ft · Trainer ${formatPosition(spatial.trainerPosition)}
Movimento Pokémon ${battle.player.movementRemaining} ft · Trainer ${spatial.trainerMovementRemaining} ft
Azione ${battle.player.actionAvailable ? "libera" : "usata"} · Bonus ${battle.player.bonusActionAvailable ? "libero" : "usato"}${battle.player.disengaged ? " · Disengage attivo" : ""}`
    : "";

  if (battle.pendingTrainerReaction) {
    const pending = battle.pendingTrainerReaction;
    const feature = (snapshot.trainerGameplay?.features ?? []).find((entry) => entry.id === pending.featureId);
    if (feature?.legal) {
      const use = document.createElement("button");
      use.className = "move-button";
      use.innerHTML =
        `<strong>Reaction · ${escapeHtml(pending.featureId.replaceAll("-", " "))}</strong>` +
        `<small>${escapeHtml(pending.trigger.replaceAll("_", " "))} · costo ${escapeHtml(feature.resource?.cost ?? 1)}</small>`;
      use.addEventListener("click", () => runCombatAction("/api/combat/trainer-reaction", {
        useReaction: true
      }));
      els.moveList.append(use);
    }
    const decline = document.createElement("button");
    decline.className = "move-button";
    decline.innerHTML = "<strong>Non usare la Reaction</strong><small>Continua la risoluzione dell'attacco</small>";
    decline.addEventListener("click", () => runCombatAction("/api/combat/trainer-reaction", {
      useReaction: false
    }));
    els.moveList.append(decline);
  } else if (battle.awaitingSwitch === "player") {
    for (const reserve of battle.playerBench.filter((entry) => entry.hp.current > 0)) {
      const button = document.createElement("button");
      button.className = "move-button";
      button.innerHTML = `<img class="pokemon-icon" src="${spriteUrl(reserve.speciesId, "icon")}" alt=""><span><strong>Cambia in ${escapeHtml(reserve.name)}</strong><small>HP ${reserve.hp.current}/${reserve.hp.max}</small></span>`;
      button.addEventListener("click", () => runCombatAction("/api/combat/switch", { benchIndex: reserve.index }));
      els.moveList.append(button);
      addBattleAction(`Posiziona ${reserve.name}`, "Scegli il punto di ingresso entro 15 ft dal Trainer",
        () => openBattlePositionForm("switch", { benchIndex: reserve.index }));
    }
  } else {
    for (const move of battle.moves) {
      const button = document.createElement("button");
      button.className = "move-button";
      button.innerHTML =
        `<strong>${escapeHtml(move.name)}</strong>` +
        `<small>${escapeHtml(move.time?.unit ?? "")} · PP ${move.ppCurrent}/${move.ppMax}</small>`;
      button.addEventListener("click", () => useBattleMove(move));
      els.moveList.append(button);
    }
  }

  if (!battle.pendingTrainerReaction && battle.awaitingSwitch !== "player" && battle.actor === "player") {
    if (spatial?.pokemonMovementModes?.length) {
      const modes = spatial.pokemonMovementModes.map((entry) => `${entry.type} ${entry.remaining} ft`).join(", ");
      addBattleAction("Muovi Pokémon", modes, () => openBattlePositionForm("pokemon"));
    }
    if (spatial?.trainerMovementRemaining > 0) {
      addBattleAction("Muovi Trainer", `${spatial.trainerMovementRemaining} ft rimasti`,
        () => openBattlePositionForm("trainer"));
    }
    if (spatial?.disengageAvailable) {
      addBattleAction("Disengage", "1 Azione Pokémon · movimento senza attacchi di opportunità",
        () => runCombatAction("/api/combat/disengage", {}));
    }
    if (spatial?.voluntarySwitchAvailable) {
      for (const reserve of battle.playerBench.filter((entry) => entry.hp.current > 0)) {
        addBattleAction(`Cambia in ${reserve.name}`, `HP ${reserve.hp.current}/${reserve.hp.max} · Azione Trainer + Pokémon`,
          () => runCombatAction("/api/combat/switch", { benchIndex: reserve.index }));
        addBattleAction(`Posiziona ${reserve.name}`, "Cambio con punto di ingresso personalizzato",
          () => openBattlePositionForm("switch", { benchIndex: reserve.index }));
      }
    }
    for (const feature of snapshot.trainerGameplay?.features ?? []) {
      if (!feature.executable) continue;
      const button = document.createElement("button");
      button.className = "move-button";
      button.disabled = !feature.legal;
      const resource = feature.resourceId
        ? ` · ${feature.resource.current}/${feature.resource.max}`
        : "";
      button.innerHTML =
        `<strong>Trainer · ${escapeHtml(playerFacingLabel(feature.id))}</strong>` +
        `<small>${escapeHtml(feature.action ?? "")}${escapeHtml(resource)}${feature.legal ? "" : ` · ${escapeHtml(feature.reason ?? "non disponibile")}`}</small>`;
      if (feature.legal) {
        const mode = feature.id === "battle-master" || feature.id === "cheerleader" ? "attack" : null;
        button.addEventListener("click", () => runCombatAction("/api/combat/trainer-feature", {
          featureId: feature.id,
          mode
        }));
      }
      els.moveList.append(button);
    }
  }

  if (battle.capture?.available) {
    for (const ball of battle.capture.balls ?? []) {
      const button = document.createElement("button");
      button.className = "move-button";
      button.innerHTML =
        `<strong>Lancia ${escapeHtml(ball.id)}</strong>` +
        `<small>Poké Ball disponibile: ${escapeHtml(ball.count)} · tiro di cattura Pokémon 5e</small>`;
      button.addEventListener("click", () => runCombatAction("/api/combat/capture", { ball: ball.id }));
      els.moveList.append(button);
    }
  }

  if (battle.flee?.available) {
    const button = document.createElement("button");
    button.className = "move-button";
    button.innerHTML = "<strong>Tenta la fuga</strong><small>Prova di fuga Pokémon 5e · niente cattura automatica</small>";
    button.addEventListener("click", () => runCombatAction("/api/combat/flee", {}));
    els.moveList.append(button);
  }

  els.endTurn.hidden = battle.awaitingSwitch === "player" || Boolean(battle.pendingTrainerReaction);
  els.endTurn.disabled = battle.actor !== "player";

  els.combatLog.replaceChildren();
  for (const entry of battle.log) {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.textContent = formatLog(entry);
    els.combatLog.append(div);
  }
}

async function runCombatAction(path, body) {
  try {
    snapshot = await api(path, {
      method: "POST",
      body: JSON.stringify(body)
    });
    await renderSnapshot();
  } catch (error) {
    showInlineError(error.message);
  }
}

async function renderStory() {
  els.battleScreen.hidden = true;
  els.storyScreen.hidden = false;
  renderRoll();
  await revealStory(snapshot.story);
}

async function renderSnapshot() {
  els.appAlert.hidden = true;
  if (!snapshot?.hasSession) {
    els.appShell.inert = true;
    els.startScreen.hidden = false;
    return;
  }

  els.startScreen.hidden = true;
  els.appShell.inert = els.drawer.classList.contains("is-open");
  renderHeader();

  if (snapshot.battle) {
    ++revealRun;
    revealActive = false;
    revealFinish = null;
    renderBattle(snapshot.battle);
  } else {
    await renderStory();
  }
}


async function playEvolution(presentation) {
  if (!presentation) return;
  els.evolutionFrom.dataset.species = presentation.from ?? "";
  els.evolutionTo.dataset.species = presentation.to ?? presentation.pokemon?.speciesId ?? "";
  els.evolutionFromSprite.src = spriteUrl(presentation.from, "battleFront");
  els.evolutionToSprite.src = spriteUrl(presentation.to ?? presentation.pokemon?.speciesId, "battleFront");
  els.evolutionOverlay.hidden = false;
  for (const phase of presentation.phases ?? []) {
    els.evolutionOverlay.dataset.phase = phase.id;
    els.evolutionStatus.textContent = phase.id === "reveal"
      ? `${playerFacingLabel(presentation.to ?? presentation.pokemon?.speciesId ?? "Pokémon")}!`
      : "Il Pokémon si sta evolvendo…";
    if (phase.durationMs > 0) await delay(phase.durationMs);
  }
  els.evolutionOverlay.hidden = true;
  delete els.evolutionOverlay.dataset.phase;
}

async function runEvolution(option) {
  try {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let payload = await api("/api/evolution/apply", {
      method: "POST",
      body: JSON.stringify({ rosterIndex: option.rosterIndex, evolutionId: option.evolution.id, reducedMotion })
    });
    if (payload.evolution.result.status === "choice_required") {
      const points = Number(payload.evolution.result.choice.points);
      const pokemon = snapshot.player.roster[option.rosterIndex];
      const distribution = await chooseAsiDistribution(pokemon, points, "Evoluzione · caratteristiche", { maxPerStat: 4 });
      if (!distribution) return;
      payload = await api("/api/evolution/apply", {
        method: "POST",
        body: JSON.stringify({
          rosterIndex: option.rosterIndex,
          evolutionId: option.evolution.id,
          asiDistribution: distribution,
          reducedMotion
        })
      });
    }
    snapshot = payload.snapshot;
    closeDrawer();
    await playEvolution(payload.evolution.presentation);
    await renderSnapshot();
  } catch (error) {
    showInlineError(error.message);
  }
}

function renderTrainer() {
  const player = snapshot.player;
  const stats = Object.entries(player.abilities ?? {})
    .map(([key, value]) => `<div class="stat-tile"><small>${escapeHtml(key)}</small><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  const specializationNames = (player.specializationDetails ?? [])
    .map((entry) => entry.name ?? entry.type)
    .filter(Boolean);

  const fallbackSpecs = Object.entries(player.specializations ?? {})
    .filter(([, ranks]) => Number(ranks) > 0)
    .map(([type, ranks]) => ranks > 1 ? `${type} ×${ranks}` : type);

  const specs = specializationNames.length ? specializationNames : fallbackSpecs;
  const pathLabel = player.trainerPath
    ? String(player.trainerPath).replaceAll("-", " ")
    : "Non ancora scelta";

  const hp = player.hp
    ? `${escapeHtml(player.hp.current)}/${escapeHtml(player.hp.max)}`
    : "—";

  const conditions = (player.conditions ?? []).length
    ? player.conditions.map(escapeHtml).join(" · ")
    : "Nessuna";

  return `
    <div class="data-card">
      <h3>${escapeHtml(player.name)} · Trainer Lv. ${escapeHtml(player.trainerLevel)}</h3>
      <div class="data-row"><span>Classe</span><span>${escapeHtml(player.trainerClass ?? "Pokémon Trainer")}</span></div>
      <div class="data-row"><span>Trainer Path</span><span>${escapeHtml(pathLabel)}</span></div>
      <div class="data-row"><span>Specialization</span><span>${specs.map(escapeHtml).join(" · ") || "Da scegliere"}</span></div>
      <div class="data-row"><span>HP</span><span>${hp}</span></div>
      <div class="data-row"><span>AC</span><span>${escapeHtml(player.ac ?? "—")}</span></div>
      <div class="data-row"><span>Pokéslots</span><span>${escapeHtml(player.pokeslots ?? "—")}</span></div>
      <div class="data-row"><span>Max SR</span><span>${escapeHtml(player.maxSr ?? "—")}</span></div>
    </div>
    <div class="data-card">
      <h3>Caratteristiche</h3>
      <div class="stat-grid">${stats}</div>
    </div>
    <div class="data-card">
      <h3>Competenze</h3>
      <div class="data-row"><span>Saving Throws</span><span>${(player.savingThrows ?? []).map(escapeHtml).join(" · ") || "—"}</span></div>
      <div class="data-row"><span>Skills</span><span>${(player.skills ?? []).map(escapeHtml).join(" · ") || "—"}</span></div>
      <div class="data-row"><span>Expertise</span><span>${(player.proficiencies?.expertise ?? []).map(escapeHtml).join(" · ") || "—"}</span></div>
    </div>
    <div class="data-card">
      <h3>Feature e condizioni</h3>
      <div class="data-row"><span>Condizioni</span><span>${conditions}</span></div>
      <div class="data-row"><span>Stato</span><span>${escapeHtml(snapshot.trainerGameplay?.death?.state === "alive" ? "In salute" : playerFacingLabel(snapshot.trainerGameplay?.death?.state ?? ""))}</span></div>
      ${(snapshot.trainerGameplay?.features ?? []).map((feature) => `
        <div class="data-row">
          <span>${escapeHtml(feature.id.replaceAll("-", " "))}</span>
          <span>${feature.resourceId ? `${escapeHtml(feature.resource.current)}/${escapeHtml(feature.resource.max)}` : (feature.executable ? "Disponibile" : "Passiva/contestuale")}</span>
        </div>
      `).join("") || '<div class="data-row"><span>Feature</span><span>—</span></div>'}
    </div>
    <div class="data-card">
      <h3>Risorse</h3>
      ${Object.entries(snapshot.trainerGameplay?.classResources ?? {}).map(([id, resource]) => `
        <div class="data-row"><span>${escapeHtml(resource.name ?? id)}</span><span>${escapeHtml(resource.current ?? 0)}/${escapeHtml(resource.max ?? 0)}</span></div>
      `).join("") || '<div class="data-row"><span>Risorse</span><span>—</span></div>'}
    </div>
    <div class="data-card">
      <h3>Trainer Gear ed equipaggiamento</h3>
      ${(snapshot.trainerGameplay?.trainerGear ?? []).map((gear) => {
        const id = typeof gear === "string" ? gear : gear.id ?? gear.itemId;
        const equipped = (snapshot.trainerGameplay?.equipment ?? []).some((entry) => (entry.id ?? entry.itemId) === id);
        return `<div class="data-row"><span>${escapeHtml(playerFacingLabel(id))}</span><button type="button" class="gear-toggle" data-gear-id="${escapeHtml(id)}" data-equipped="${equipped ? "1" : "0"}">${equipped ? "Rimuovi" : "Equipaggia"}</button></div>`;
      }).join("") || '<div class="data-row"><span>Trainer Gear</span><span>—</span></div>'}
    </div>
  `;
}

function renderTeam() {
  const roster = snapshot.player.roster ?? [];
  const options = snapshot.evolutions ?? [];
  return roster.map((pokemon, index) => {
    const name = pokemon.nickname ?? pokemon.name ?? pokemon.speciesId ?? `Pokémon ${index + 1}`;
    const available = options.filter((entry) => entry.rosterIndex === index);
    const attrs = Object.entries(pokemon.attributes ?? {})
      .map(([key, value]) => `<span><strong>${escapeHtml(key.toUpperCase())}</strong> ${escapeHtml(value)}</span>`)
      .join(" · ");
    const moves = (pokemon.moves ?? []).map((move) => `
      <div class="data-row">
        <span>${escapeHtml(move.name)} · ${escapeHtml(move.type ?? "—")}</span>
        <span>PP ${escapeHtml(move.ppCurrent)}/${escapeHtml(move.ppMax)}</span>
      </div>
    `).join("");
    const pending = [
      ...(pokemon.pendingLevelUp ? [`Una decisione di crescita attende ${name}`] : []),
      ...(pokemon.pendingAsiChoices ?? []).map((choice) => `Migliora le caratteristiche (Lv. ${choice.level}): ${choice.points} punti`),
      ...(pokemon.pendingMoveLearning ?? []).map((choice) => `Mossa apprendibile: ${choice.moveName ?? playerFacingLabel(choice.moveId)}`),
      ...(pokemon.pendingMoveChoices ?? []).map((choice) => `Scelta mossa Lv.${choice.level}`)
    ];
    const xp = pokemon.xp == null
      ? "—"
      : pokemon.nextLevelXp == null ? `${pokemon.xp} · livello massimo` : `${pokemon.xp}/${pokemon.nextLevelXp}`;

    return `
      <div class="data-card pokemon-card">
        <img class="pokemon-icon pokemon-icon--team" src="${spriteUrl(pokemon.speciesId ?? pokemon.species, "icon")}" alt="">
        <div class="pokemon-card__body"><h3>${escapeHtml(name)} · ${index < 6 ? "Sei schierabili" : "Riserva"}</h3>
        <div class="data-row"><span>Specie</span><span>${escapeHtml(pokemon.name ?? pokemon.speciesId ?? "—")}${pokemon.form ? ` · ${escapeHtml(pokemon.form)}` : ""}</span></div>
        <div class="data-row"><span>Livello / XP</span><span>${escapeHtml(pokemon.level ?? "—")} · ${escapeHtml(xp)}</span></div>
        <div class="data-row"><span>Tipo</span><span>${(pokemon.types ?? []).map(escapeHtml).join(" / ") || "—"}</span></div>
        <div class="data-row"><span>HP / AC</span><span>${escapeHtml(pokemon.hp?.current ?? "—")}/${escapeHtml(pokemon.hp?.max ?? "—")} · AC ${escapeHtml(pokemon.ac ?? "—")}</span></div>
        <div class="data-row"><span>SR / Taglia</span><span>${escapeHtml(pokemon.sr ?? "—")} · ${escapeHtml(pokemon.size ?? "—")}</span></div>
        <div class="data-row"><span>Statistiche</span><span>${attrs || "—"}</span></div>
        <div class="data-row"><span>Ability</span><span>${escapeHtml(pokemon.ability?.name ?? pokemon.ability?.id ?? "—")}</span></div>
        <div class="data-row"><span>Hit Dice</span><span>${escapeHtml(pokemon.hitDice?.current ?? "—")}/${escapeHtml(pokemon.hitDice?.max ?? "—")} ${escapeHtml(pokemon.hitDice?.die ?? "")}</span></div>
        <div class="data-row"><span>Condizioni</span><span>${(pokemon.statuses ?? []).map(escapeHtml).join(" · ") || "Nessuna"}</span></div>
        ${pokemon.nature ? `<div class="data-row"><span>Natura</span><span>${escapeHtml(pokemon.nature)}</span></div>` : ""}
        ${pokemon.heldItemId ? `<div class="data-row"><span>Oggetto</span><span>${escapeHtml(playerFacingLabel(pokemon.heldItemId))}</span></div>` : ""}
        </div>
      </div>
      <div class="data-card">
        <h3>Mosse · ${escapeHtml(name)}</h3>
        ${moves || '<div class="data-row"><span>Mosse</span><span>—</span></div>'}
      </div>
      ${pending.length ? `<div class="data-card"><h3>Progressione pendente</h3>
        ${pending.map((entry) => `<div class="data-row"><span>${escapeHtml(entry)}</span></div>`).join("")}
        ${pokemon.pendingLevelUp?.stage === "evolution_decision" ? `
          ${(pokemon.pendingLevelUp.evolutionIds ?? []).map((id, evoIndex) => {
             const evolution = available.find((entry) => entry.evolution.id === id);
             return `<button type="button" class="primary-button levelup-evolution" data-roster-index="${index}" data-evolution-id="${escapeHtml(id)}">Evolvi → ${escapeHtml(evolution ? playerFacingLabel(evolution.evolution.to) : `Evoluzione ${evoIndex + 1}`)}</button>`;
           }).join("")}
          <button type="button" class="levelup-decline" data-roster-index="${index}">Rimanda evoluzione</button>
        ` : ""}
        ${(pokemon.pendingMoveLearning ?? []).map((choice) => `<button type="button" class="pokemon-learn-move" data-roster-index="${index}" data-move-id="${escapeHtml(choice.moveId)}">Impara ${escapeHtml(choice.moveName ?? playerFacingLabel(choice.moveId))}</button>`).join("")}
        ${(pokemon.pendingMoveChoices ?? []).map((choice) => `<button type="button" class="pokemon-replace-move" data-roster-index="${index}" data-level="${choice.level}" data-move-ids="${escapeHtml((choice.availableMoveIds ?? []).join(","))}">Scegli mossa Lv.${choice.level}</button>`).join("")}
        ${(pokemon.pendingAsiChoices ?? []).map((choice) => `<button type="button" class="pokemon-asi" data-roster-index="${index}" data-level="${choice.level}" data-points="${choice.points}">Migliora caratteristiche · Lv. ${choice.level}</button>`).join("")}
      </div>` : ""}
      ${available.map((entry) => `<button type="button" class="primary-button evolution-action" data-roster-index="${entry.rosterIndex}" data-evolution-id="${escapeHtml(entry.evolution.id)}">Evolvi → ${escapeHtml(playerFacingLabel(entry.evolution.to))}</button>`).join("")}
    `;
  }).join("") || '<div class="data-card">Nessun Pokémon nel roster.</div>';
}

function renderBag() {
  const inventory = snapshot.player.inventory ?? [];
  if (inventory.length === 0) return '<div class="data-card">Inventario vuoto.</div>';
  const battle = snapshot.battle;
  const canUse = Boolean(battle && battle.actor === "player" && battle.awaitingSwitch !== "player" && battle.trainerActionAvailable);
  const moveOptions = (battle?.moves ?? [])
    .map((move) => `<option value="${escapeHtml(move.id)}">${escapeHtml(move.name)} · PP ${escapeHtml(move.ppCurrent)}/${escapeHtml(move.ppMax)}</option>`)
    .join("");
  return inventory.map((item, index) => {
    const id = typeof item === "string" ? item : item.id ?? item.name ?? "";
    const name = typeof item === "string" ? item : item.name ?? item.id ?? "Oggetto";
    return `
      <div class="data-card">
        <h3>${escapeHtml(name)}</h3>
        ${battle ? `
          <div class="data-row">
            <span>Bersaglio</span>
            <span>Pokémon attivo</span>
          </div>
          ${moveOptions ? `<label class="data-row"><span>Mossa (se richiesta)</span><select class="item-move" data-item-index="${index}"><option value="">—</option>${moveOptions}</select></label>` : ""}
          <button type="button" class="item-use" data-item-id="${escapeHtml(id)}" data-item-index="${index}" ${canUse ? "" : "disabled"}>Usa</button>
          ${canUse ? "" : '<small>Disponibile durante il tuo turno quando l’azione Trainer è libera.</small>'}
        ` : "<small>Gli oggetti di combattimento si usano dalla Bag durante il tuo turno.</small>"}
      </div>
    `;
  }).join("");
}

function renderJournal() {
  const journal = snapshot.story.questJournal ?? {};
  const groups = [
    ["active", "In corso"], ["completed", "Completate"],
    ["failed", "Fallite"], ["expired", "Scadute"]
  ];
  const normalized = Array.isArray(journal) ? { active: journal } : journal;
  return groups.map(([key, title]) => {
    const quests = Array.isArray(normalized[key]) ? normalized[key] : [];
    return `<section class="data-card"><h3>${title} · ${quests.length}</h3>${quests.map((quest) =>
      `<div class="info-quest"><strong>${escapeHtml(quest.title ?? "Missione")}</strong>
      <p>${escapeHtml(quest.objective ?? "Nessun obiettivo specificato.")}</p></div>`
    ).join("") || "<p>Nessuna missione.</p>"}</section>`;
  }).join("");
}

function renderMap() {
  // Keep future choices hidden until the narrated text has finished revealing.
  const nodes = (snapshot.map?.nodes ?? []).filter((node) => !revealActive || node.visited);
  const routes = revealActive ? 0 : nodes.reduce((total, node) => total + node.routes.length, 0);
  const blocked = Boolean(snapshot.battle || snapshot.careerEnded || revealActive);
  return `
    <p class="map-intro">Schema dei luoghi conosciuti. I collegamenti non indicano distanze reali: puoi viaggiare solo lungo le strade offerte dalla scena attuale.</p>
    <div class="travel-map" role="group" aria-label="Mappa schematica dei luoghi conosciuti">
      ${nodes.map((node) => `
        <section class="map-site ${node.current ? "map-site--current" : ""} ${node.routes.length ? "map-site--reachable" : ""}">
          <span class="map-pin" aria-hidden="true">●</span>
          <div class="map-site__body">
            ${node.illustrationId ? `<img class="map-site__art" src="/map-art/${encodeURIComponent(node.illustrationId)}.${node.illustrationFormat === "svg" ? "svg" : "png"}" alt="Illustrazione pixel art di ${escapeHtml(node.label)}" loading="lazy" decoding="async">` : ""}
            <strong>${escapeHtml(node.label)}</strong>
            <small>${node.current ? "Sei qui" : node.routes.length ? "Raggiungibile ora" : "Già visitato · nessun percorso disponibile da qui"}</small>
            ${(revealActive ? [] : node.routes).map((route) => `
              <button type="button" class="map-travel" data-map-choice="${escapeHtml(route.choiceId)}" ${blocked ? "disabled" : ""}>
                ${escapeHtml(route.label)}
                <small>${route.timeCostMinutes === null ? "Durata non indicata" : `${route.timeCostMinutes} min`}</small>
              </button>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
    <p class="map-footnote" role="status" id="map-status">${snapshot.battle ? "Viaggio non disponibile durante un combattimento." :
      snapshot.careerEnded ? "Carriera conclusa: la mappa è consultabile." :
      revealActive ? "Completa il testo della scena prima di partire." :
      routes ? "Tocca una destinazione raggiungibile per seguire la scelta prevista dalla storia." :
      "Da questa scena non ci sono collegamenti di viaggio disponibili. Prosegui con le scelte della storia."}</p>
  `;
}

function renderSettings() {
  const speed = currentTextSpeed();
  return `
    <div class="settings-row">
      <label for="text-speed-setting">Velocità testo</label>
      <select id="text-speed-setting">
        <option value="slow" ${speed === "slow" ? "selected" : ""}>Lenta</option>
        <option value="normal" ${speed === "normal" ? "selected" : ""}>Normale</option>
        <option value="fast" ${speed === "fast" ? "selected" : ""}>Veloce</option>
        <option value="instant" ${speed === "instant" ? "selected" : ""}>Istantanea</option>
      </select>
    </div>
    <div class="data-card">
      <h3>Salvataggio · ${escapeHtml(snapshot.slot ?? "")}</h3>
      <p>La partita viene salvata automaticamente dopo ogni scelta e azione. Puoi salvare anche adesso.</p>
      <button type="button" class="primary-button" id="manual-save">Salva adesso</button>
      <button type="button" class="secondary-button" id="career-menu">Torna alle carriere</button>
    </div>
  `;
}

function openDrawer(panel) {
  if (!snapshot?.hasSession) return;
  const infoPages = informationRenderers(snapshot, { escapeHtml, spriteUrl, playerFacingLabel });

  const titles = {
    pokedex: "Pokédex",
    people: "Persone importanti",
    relations: "Relazioni",
    reputation: "Reputazione",
    progress: "Progressione",
    hall: "Hall of Fame",
    codex: "Codex e regole",
    trainer: "Trainer",
    team: "Pokémon",
    bag: "Inventario",
    journal: "Journal",
    map: "Mappa",
    settings: "Impostazioni"
  };

  const renderers = {
    pokedex: infoPages.pokedex,
    people: infoPages.people,
    relations: infoPages.relations,
    reputation: infoPages.reputation,
    progress: infoPages.progress,
    hall: infoPages.hall,
    codex: infoPages.codex,
    trainer: renderTrainer,
    team: renderTeam,
    bag: renderBag,
    journal: renderJournal,
    map: renderMap,
    settings: renderSettings
  };

  if (!renderers[panel]) return;
  const wasOpen = els.drawer.classList.contains("is-open");
  if (!wasOpen) drawerReturnFocus = document.activeElement;
  els.drawerTitle.textContent = titles[panel];
  els.drawer.dataset.panel = panel;
  const shortcuts = infoPages.shortcuts()[panel] ?? "";
  els.drawerContent.innerHTML = shortcuts + renderers[panel]();
  for (const button of els.drawerContent.querySelectorAll("[data-info-panel]")) {
    button.addEventListener("click", () => openDrawer(button.dataset.infoPanel));
  }
  els.drawerBackdrop.hidden = false;
  els.drawer.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");
  els.drawer.inert = false;
  els.appShell.inert = true;
  if (!wasOpen || !els.drawer.contains(document.activeElement)) els.closeDrawer.focus();

  for (const button of els.drawerContent.querySelectorAll(".map-travel")) {
    button.addEventListener("click", async () => {
      if (button.disabled || revealActive) return;
      const choiceId = button.dataset.mapChoice;
      // Client controls never invent a navigation action; server revalidates it.
      if (!(snapshot.story.choices ?? []).some((choice) => choice.id === choiceId)) return;
      for (const travel of els.drawerContent.querySelectorAll(".map-travel")) travel.disabled = true;
      try {
        snapshot = await api("/api/choose", { method: "POST", body: JSON.stringify({ choiceId }) });
        closeDrawer();
        await renderSnapshot();
      } catch (error) {
        for (const travel of els.drawerContent.querySelectorAll(".map-travel")) travel.disabled = false;
        const status = els.drawerContent.querySelector("#map-status");
        if (status) status.textContent = error.message;
      }
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".gear-toggle")) {
    button.addEventListener("click", async () => {
      try {
        snapshot = await api("/api/trainer/gear", {
          method: "POST",
          body: JSON.stringify({
            gearId: button.dataset.gearId,
            equipped: button.dataset.equipped !== "1"
          })
        });
        els.drawerContent.innerHTML = renderTrainer();
        openDrawer("trainer");
      } catch (error) {
        showInlineError(error.message);
      }
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".evolution-action")) {
    button.addEventListener("click", () => {
      const option = (snapshot.evolutions ?? []).find((entry) =>
        entry.rosterIndex === Number(button.dataset.rosterIndex) &&
        entry.evolution.id === button.dataset.evolutionId
      );
      if (option) runEvolution(option);
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".levelup-evolution, .levelup-decline")) {
    button.addEventListener("click", async () => {
      try {
        let payload = await api("/api/pokemon/level-up", {
          method: "POST",
          body: JSON.stringify({
            rosterIndex: Number(button.dataset.rosterIndex),
            evolutionId: button.classList.contains("levelup-evolution") ? button.dataset.evolutionId : null,
            declineEvolution: button.classList.contains("levelup-decline")
          })
        });
        if (payload.progression?.status === "choice_required" && payload.progression.choice?.type === "evolution_asi") {
          const points = Number(payload.progression.choice.points);
          const pokemon = snapshot.player.roster[Number(button.dataset.rosterIndex)];
          const distribution = await chooseAsiDistribution(pokemon, points, "Evoluzione · caratteristiche", { maxPerStat: 4 });
          if (!distribution) return;
          payload = await api("/api/pokemon/level-up", {
            method: "POST",
            body: JSON.stringify({
              rosterIndex: Number(button.dataset.rosterIndex),
              evolutionId: button.dataset.evolutionId,
              asiDistribution: distribution
            })
          });
        }
        snapshot = payload.snapshot;
        openDrawer("team");
      } catch (error) {
        showInlineError(error.message);
      }
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".pokemon-learn-move")) {
    button.addEventListener("click", async () => {
      try {
        const pokemon = snapshot.player.roster[Number(button.dataset.rosterIndex)];
        let forgetMoveId = null;
        if ((pokemon.moves ?? []).length >= 4) {
          forgetMoveId = await chooseMoveToForget(pokemon);
          if (!forgetMoveId) return;
        }
        snapshot = await api("/api/pokemon/learn-move", {
          method: "POST",
          body: JSON.stringify({ rosterIndex: Number(button.dataset.rosterIndex), moveId: button.dataset.moveId, forgetMoveId })
        });
        openDrawer("team");
      } catch (error) {
        showInlineError(error.message);
      }
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".pokemon-replace-move")) {
    button.addEventListener("click", async () => {
      try {
        const pokemon = snapshot.player.roster[Number(button.dataset.rosterIndex)];
        const choice = (pokemon.pendingMoveChoices ?? []).find((entry) => Number(entry.level) === Number(button.dataset.level));
        const availableMoves = choice?.availableMoves ?? [];
        const moveId = await chooseTouchOption({
          title: `Quale mossa imparerà ${pokemonDisplayName(pokemon)}?`,
          description: "Scegli una mossa disponibile. La scelta può richiedere di dimenticarne un'altra.",
          options: availableMoves.map((move) => ({
            value: move.id,
            label: move.name ?? playerFacingLabel(move.id)
          }))
        });
        if (!moveId) return;
        let forgetMoveId = null;
        if ((pokemon.moves ?? []).length >= 4 && !(pokemon.moves ?? []).some((move) => move.id === moveId)) {
          forgetMoveId = await chooseMoveToForget(pokemon);
          if (!forgetMoveId) return;
        }
        snapshot = await api("/api/pokemon/replace-move", {
          method: "POST",
          body: JSON.stringify({ rosterIndex: Number(button.dataset.rosterIndex), level: Number(button.dataset.level), moveId, forgetMoveId })
        });
        openDrawer("team");
      } catch (error) {
        showInlineError(error.message);
      }
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".pokemon-asi")) {
    button.addEventListener("click", async () => {
      try {
        const points = Number(button.dataset.points);
        const pokemon = snapshot.player.roster[Number(button.dataset.rosterIndex)];
        const pendingChoice = (pokemon.pendingAsiChoices ?? []).find((entry) => Number(entry.level) === Number(button.dataset.level));
        const distribution = await chooseAsiDistribution(pokemon, points, "Migliora le caratteristiche", { maxScore: Number(pendingChoice?.maxScore ?? 20) });
        if (!distribution) return;
        snapshot = await api("/api/pokemon/asi", {
          method: "POST",
          body: JSON.stringify({
            rosterIndex: Number(button.dataset.rosterIndex),
            level: Number(button.dataset.level),
            distribution
          })
        });
        openDrawer("team");
      } catch (error) {
        showInlineError(error.message);
      }
    });
  }

  for (const button of els.drawerContent.querySelectorAll(".item-use")) {
    button.addEventListener("click", async () => {
      try {
        const move = els.drawerContent.querySelector(`.item-move[data-item-index="${button.dataset.itemIndex}"]`);
        snapshot = await api("/api/combat/item", {
          method: "POST",
          body: JSON.stringify({
            itemId: button.dataset.itemId,
            targetSide: "player",
            moveId: move?.value || null
          })
        });
        openDrawer("bag");
      } catch (error) {
        showInlineError(error.message);
      }
    });
  }

  const speedSelect = $("#text-speed-setting");
  if (speedSelect) {
    speedSelect.addEventListener("change", () => {
      localStorage.setItem("p5e_text_speed", speedSelect.value);
    });
  }
  els.drawerContent.querySelector("#manual-save")?.addEventListener("click", async (event) => {
    try {
      await api("/api/save", { method: "POST", body: "{}" });
      event.currentTarget.textContent = "Salvato";
    } catch (error) {
      showInlineError(error.message);
    }
  });
  els.drawerContent.querySelector("#career-menu")?.addEventListener("click", async () => {
    try {
      await api("/api/leave", { method: "POST", body: "{}" });
      snapshot = { ok: true, hasSession: false };
      ++revealRun;
      finishRevealNow();
      closeDrawer();
      await refreshSlots();
      await renderSnapshot();
    } catch (error) {
      showInlineError(error.message);
    }
  });
}

function closeDrawer() {
  const wasOpen = els.drawer.classList.contains("is-open");
  els.drawer.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawer.inert = true;
  els.drawerBackdrop.hidden = true;
  els.appShell.inert = !snapshot?.hasSession;
  delete els.drawer.dataset.panel;
  if (wasOpen) {
    const target = drawerReturnFocus;
    drawerReturnFocus = null;
    if (!els.startScreen.hidden) els.slot.focus();
    else if (target?.isConnected && !target.closest("[inert]")) target.focus();
    else document.querySelector(".bottom-nav button")?.focus();
  }
}

async function start(mode) {
  els.startError.hidden = true;
  try {
    const slot = els.slot.value;
    const selected = careerSlots.find((entry) => entry.slot === slot);
    let confirmOverwrite = false;
    if (mode === "new" && selected?.occupied) {
      confirmOverwrite = window.confirm(`Sovrascrivere definitivamente lo Slot ${selected.number}? ${describeSlot(selected)}. Tutti i progressi andranno persi.`);
      if (!confirmOverwrite) return;
    }
    const path = mode === "load" ? "/api/load" : "/api/new-game";
    snapshot = await api(path, {
      method: "POST",
      body: JSON.stringify({
        protagonist: els.protagonist.value,
        slot,
        confirmOverwrite
      })
    });
    await refreshSlots();
    await renderSnapshot();
  } catch (error) {
    els.startError.hidden = false;
    els.startError.textContent = error.message;
    await refreshSlots().catch(() => {});
  }
}

async function deleteCareer() {
  const selected = careerSlots.find((entry) => entry.slot === els.slot.value);
  if (!selected?.occupied) return;
  if (!window.confirm(`Eliminare definitivamente lo Slot ${selected.number}? ${describeSlot(selected)}. Non potrai recuperare la carriera.`)) return;
  try {
    await api("/api/delete-slot", {
      method: "POST",
      body: JSON.stringify({ slot: selected.slot, confirmDelete: true })
    });
    snapshot = { ok: true, hasSession: false };
    await refreshSlots();
    await renderSnapshot();
  } catch (error) {
    els.startError.hidden = false;
    els.startError.textContent = error.message;
  }
}

function openStartReference(title, content) {
  referenceReturnFocus = document.activeElement;
  els.referenceTitle.textContent = title;
  els.referenceContent.innerHTML = content;
  els.startScreen.inert = true;
  els.referenceOverlay.hidden = false;
  els.referenceClose.focus();
}

function closeStartReference() {
  els.referenceOverlay.hidden = true;
  els.referenceContent.replaceChildren();
  els.startScreen.inert = false;
  const target = referenceReturnFocus;
  referenceReturnFocus = null;
  if (target?.isConnected) target.focus();
}

els.startCodex.addEventListener("click", () => {
  const pages = informationRenderers({ player: {}, information: {} }, { escapeHtml, spriteUrl, playerFacingLabel });
  openStartReference("Codex e regole", pages.codex());
});
els.startHall.addEventListener("click", async () => {
  try {
    const result = await api("/api/slot-hall?slot=" + encodeURIComponent(els.slot.value));
    const pages = informationRenderers(
      { player: {}, information: { hallOfFame: result.entries } },
      { escapeHtml, spriteUrl, playerFacingLabel }
    );
    openStartReference("Hall of Fame", pages.hall());
  } catch (error) {
    openStartReference("Hall of Fame", `<div class="data-card">${escapeHtml(error.message)}</div>`);
  }
});
els.referenceClose.addEventListener("click", closeStartReference);
els.referenceOverlay.addEventListener("click", (event) => {
  if (event.target === els.referenceOverlay) closeStartReference();
});
els.referenceOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeStartReference();
  } else if (event.key === "Tab") {
    const targets = [...els.referenceOverlay.querySelectorAll("a[href], button:not(:disabled)")];
    const current = targets.indexOf(document.activeElement);
    if (event.shiftKey && current <= 0) {
      event.preventDefault();
      targets.at(-1)?.focus();
    } else if (!event.shiftKey && current === targets.length - 1) {
      event.preventDefault();
      targets[0]?.focus();
    }
  }
});

els.storyText.addEventListener("click", () => {
  if (revealActive) finishRevealNow();
});
els.skipText.addEventListener("click", finishRevealNow);
els.newGame.addEventListener("click", () => start("new"));
els.loadGame.addEventListener("click", () => start("load"));
els.deleteGame.addEventListener("click", deleteCareer);
els.slot.addEventListener("change", showSelectedSlot);
els.endTurn.addEventListener("click", () => runCombatAction("/api/combat/end-turn", {}));
els.positionCancel.addEventListener("click", () => { els.positionForm.hidden = true; });
for (const button of document.querySelectorAll("#battle-position-shortcuts button")) {
  button.addEventListener("click", () => {
    const x = Number(els.positionX.value);
    const y = Number(els.positionY.value);
    els.positionX.value = String(x + Number(button.dataset.offsetX));
    els.positionY.value = String(y + Number(button.dataset.offsetY));
  });
}
els.positionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const kind = els.positionForm.dataset.kind;
  const destination = {
    x: Number(els.positionX.value), y: Number(els.positionY.value)
  };
  if (els.positionZ.value.trim() !== "") destination.z = Number(els.positionZ.value);
  if (!Number.isFinite(destination.x) || !Number.isFinite(destination.y) ||
      (destination.z !== undefined && !Number.isFinite(destination.z))) {
    showInlineError("Coordinate non valide");
    return;
  }
  if (kind === "switch") {
    await runCombatAction("/api/combat/switch", {
      benchIndex: Number(els.positionForm.dataset.benchIndex), releasePosition: destination
    });
  } else if (kind === "move") {
    await runCombatAction("/api/combat/move", {
      moveId: els.positionForm.dataset.moveId, targetPoint: destination
    });
  } else {
    await runCombatAction("/api/combat/movement", {
      unit: kind, destination,
      ...(kind === "pokemon" ? { movementType: els.positionMode.value } : {})
    });
  }
});
document.addEventListener("keydown", (event) => {
  if (!els.drawer.classList.contains("is-open") || !els.choiceOverlay.hidden || !els.referenceOverlay.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeDrawer();
    return;
  }
  if (event.key !== "Tab") return;
  const targets = [...els.drawer.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && !element.closest("[hidden]") && element.getClientRects().length > 0);
  if (!targets.length) return;
  const active = targets.indexOf(document.activeElement);
  if (event.shiftKey && active <= 0) {
    event.preventDefault();
    targets.at(-1).focus();
  } else if (!event.shiftKey && (active === targets.length - 1 || active === -1)) {
    event.preventDefault();
    targets[0].focus();
  }
});
els.closeDrawer.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);
for (const button of document.querySelectorAll(".bottom-nav button")) {
  button.addEventListener("click", () => openDrawer(button.dataset.panel));
}

try {
  snapshot = await api("/api/snapshot");
  await refreshSlots();
  await renderSnapshot();
} catch (error) {
  els.startError.hidden = false;
  els.startError.textContent = error.message;
}
