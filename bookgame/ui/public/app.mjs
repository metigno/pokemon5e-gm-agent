import {
  normalizeTextSpeed,
  revealDelayForCharacter,
  storyParagraphs
} from "/reveal-model.mjs";

const $ = (selector) => document.querySelector(selector);

const els = {
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
  newGame: $("#new-game"),
  loadGame: $("#load-game"),
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
  playerPokemonName: $("#player-pokemon-name"),
  playerPokemonLevel: $("#player-pokemon-level"),
  playerHpFill: $("#player-hp-fill"),
  playerHpText: $("#player-hp-text"),
  playerSprite: $("#player-sprite"),
  moveList: $("#move-list"),
  endTurn: $("#end-turn"),
  combatLog: $("#combat-log"),
  evolutionOverlay: $("#evolution-overlay"),
  evolutionStatus: $("#evolution-status"),
  evolutionFrom: $("#evolution-from"),
  evolutionTo: $("#evolution-to"),
  evolutionFromSprite: $("#evolution-from-sprite"),
  evolutionToSprite: $("#evolution-to-sprite")
};

let snapshot = null;
let revealRun = 0;
let revealActive = false;
let revealFinish = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Errore HTTP ${response.status}`);
  }
  return payload;
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
  els.lastRoll.hidden = false;
  els.lastRoll.textContent = message;
}

function formatTime(world) {
  const minute = Number(world.minuteOfDay ?? 0);
  const hh = String(Math.floor(minute / 60) % 24).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${world.time ?? ""} · ${hh}:${mm}`;
}

function renderHeader() {
  if (!snapshot?.hasSession) return;
  els.sceneTitle.textContent = snapshot.story.sceneTitle;
  els.moduleLabel.textContent = `${snapshot.story.moduleId ?? "BOOKGAME"} · ${snapshot.story.sceneId}`;
  els.worldDay.textContent = `Giorno ${snapshot.world.day}`;
  els.worldTime.textContent = formatTime(snapshot.world);
  els.locationLabel.textContent = snapshot.world.locationId.replaceAll("_", " ");
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
  if (entry.type === "combat_end") return `Combattimento concluso: ${entry.outcome}.`;
  if (entry.type === "switch") return `Cambio: ${entry.out} → ${entry.in}.`;
  if (entry.type === "movement") return `${entry.actor} si muove di ${Math.round(entry.feet)} ft.`;
  return entry.type.replaceAll("_", " ");
}

function renderBattle(battle) {
  els.storyScreen.hidden = true;
  els.battleScreen.hidden = false;
  els.battleTitle.textContent = battle.encounterId;
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
    }
  } else {
    for (const move of battle.moves) {
      const button = document.createElement("button");
      button.className = "move-button";
      button.innerHTML =
        `<strong>${escapeHtml(move.name)}</strong>` +
        `<small>${escapeHtml(move.time?.unit ?? "")} · PP ${move.ppCurrent}/${move.ppMax}</small>`;
      button.addEventListener("click", () => runCombatAction("/api/combat/move", { moveId: move.id }));
      els.moveList.append(button);
    }
  }

  if (!battle.pendingTrainerReaction && battle.awaitingSwitch !== "player" && battle.actor === "player") {
    for (const feature of snapshot.trainerGameplay?.features ?? []) {
      if (!feature.executable) continue;
      const button = document.createElement("button");
      button.className = "move-button";
      button.disabled = !feature.legal;
      const resource = feature.resourceId
        ? ` · ${feature.resource.current}/${feature.resource.max}`
        : "";
      button.innerHTML =
        `<strong>Trainer · ${escapeHtml(feature.id.replaceAll("-", " "))}</strong>` +
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
  if (!snapshot?.hasSession) {
    els.startScreen.hidden = false;
    return;
  }

  els.startScreen.hidden = true;
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
      ? `${presentation.to ?? presentation.pokemon?.speciesId ?? "Pokémon"}!`
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
      const stat = window.prompt(`Evoluzione: assegna ${points} punti ASI a STR, DEX, CON, INT, WIS o CHA`, "CON");
      if (!stat) return;
      payload = await api("/api/evolution/apply", {
        method: "POST",
        body: JSON.stringify({
          rosterIndex: option.rosterIndex,
          evolutionId: option.evolution.id,
          asiDistribution: { [stat.toLowerCase()]: points },
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
      <div class="data-row"><span>Stato</span><span>${escapeHtml(snapshot.trainerGameplay?.death?.state ?? "alive")}</span></div>
      ${(snapshot.trainerGameplay?.features ?? []).map((feature) => `
        <div class="data-row">
          <span>${escapeHtml(feature.id.replaceAll("-", " "))}</span>
          <span>${feature.resourceId ? `${escapeHtml(feature.resource.current)}/${escapeHtml(feature.resource.max)}` : (feature.executable ? "Runtime" : "Passiva/contestuale")}</span>
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
        return `<div class="data-row"><span>${escapeHtml(id)}</span><button type="button" class="gear-toggle" data-gear-id="${escapeHtml(id)}" data-equipped="${equipped ? "1" : "0"}">${equipped ? "Rimuovi" : "Equipaggia"}</button></div>`;
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
      ...(pokemon.pendingLevelUp ? [`Level-up: ${pokemon.pendingLevelUp.stage ?? "decisione richiesta"}`] : []),
      ...(pokemon.pendingAsiChoices ?? []).map((choice) => `ASI Lv.${choice.level}: ${choice.points} punti`),
      ...(pokemon.pendingMoveLearning ?? []).map((choice) => `Mossa apprendibile: ${choice.moveId}`),
      ...(pokemon.pendingMoveChoices ?? []).map((choice) => `Scelta mossa Lv.${choice.level}`)
    ];
    const xp = pokemon.xp == null
      ? "—"
      : pokemon.nextLevelXp == null ? `${pokemon.xp} · livello massimo` : `${pokemon.xp}/${pokemon.nextLevelXp}`;

    return `
      <div class="data-card pokemon-card">
        <img class="pokemon-icon pokemon-icon--team" src="${spriteUrl(pokemon.speciesId ?? pokemon.species, "icon")}" alt="">
        <div class="pokemon-card__body"><h3>${escapeHtml(name)} ${index === 0 ? "· Active" : ""}</h3>
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
        ${pokemon.heldItemId ? `<div class="data-row"><span>Oggetto</span><span>${escapeHtml(pokemon.heldItemId)}</span></div>` : ""}
        </div>
      </div>
      <div class="data-card">
        <h3>Mosse · ${escapeHtml(name)}</h3>
        ${moves || '<div class="data-row"><span>Mosse</span><span>—</span></div>'}
      </div>
      ${pending.length ? `<div class="data-card"><h3>Progressione pendente</h3>${pending.map((entry) => `<div class="data-row"><span>${escapeHtml(entry)}</span></div>`).join("")}</div>` : ""}
      ${available.map((entry) => `<button type="button" class="primary-button evolution-action" data-roster-index="${entry.rosterIndex}" data-evolution-id="${escapeHtml(entry.evolution.id)}">Evolvi → ${escapeHtml(entry.evolution.to)}</button>`).join("")}
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
  const journal = snapshot.story.questJournal;
  if (!journal || (Array.isArray(journal) && journal.length === 0)) {
    return '<div class="data-card">Nessuna voce attiva nel Journal.</div>';
  }

  if (Array.isArray(journal)) {
    return journal.map((entry) => `
      <div class="data-card">
        <h3>${escapeHtml(entry.title ?? entry.questId ?? "Quest")}</h3>
        <div>${escapeHtml(entry.objective ?? entry.status ?? "")}</div>
      </div>
    `).join("");
  }

  return Object.entries(journal).map(([key, entry]) => `
    <div class="data-card">
      <h3>${escapeHtml(entry?.title ?? key)}</h3>
      <div>${escapeHtml(entry?.objective ?? entry?.status ?? "")}</div>
    </div>
  `).join("");
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
      <h3>Salvataggio</h3>
      <p>Lo stato viene salvato localmente dal runtime dopo ogni scelta e azione di combattimento.</p>
    </div>
  `;
}

function openDrawer(panel) {
  if (!snapshot?.hasSession) return;

  const titles = {
    trainer: "Trainer",
    team: "Pokémon",
    bag: "Inventario",
    journal: "Journal",
    settings: "Impostazioni"
  };

  const renderers = {
    trainer: renderTrainer,
    team: renderTeam,
    bag: renderBag,
    journal: renderJournal,
    settings: renderSettings
  };

  els.drawerTitle.textContent = titles[panel];
  els.drawerContent.innerHTML = renderers[panel]();
  els.drawerBackdrop.hidden = false;
  els.drawer.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");

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
}

function closeDrawer() {
  els.drawer.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawerBackdrop.hidden = true;
}

async function start(mode) {
  els.startError.hidden = true;
  try {
    const path = mode === "load" ? "/api/load" : "/api/new-game";
    snapshot = await api(path, {
      method: "POST",
      body: JSON.stringify({
        protagonist: els.protagonist.value,
        slot: els.slot.value.trim() || "slot1"
      })
    });
    await renderSnapshot();
  } catch (error) {
    els.startError.hidden = false;
    els.startError.textContent = error.message;
  }
}

els.storyText.addEventListener("click", () => {
  if (revealActive) finishRevealNow();
});
els.skipText.addEventListener("click", finishRevealNow);
els.newGame.addEventListener("click", () => start("new"));
els.loadGame.addEventListener("click", () => start("load"));
els.endTurn.addEventListener("click", () => runCombatAction("/api/combat/end-turn", {}));
els.closeDrawer.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);
for (const button of document.querySelectorAll(".bottom-nav button")) {
  button.addEventListener("click", () => openDrawer(button.dataset.panel));
}

try {
  snapshot = await api("/api/snapshot");
  await renderSnapshot();
} catch (error) {
  els.startError.hidden = false;
  els.startError.textContent = error.message;
}
