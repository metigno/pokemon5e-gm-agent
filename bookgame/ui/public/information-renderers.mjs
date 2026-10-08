// Player-facing, read-only pages. All campaign data comes from /api/snapshot.
export function informationRenderers(snapshot, { escapeHtml, spriteUrl, playerFacingLabel }) {
  const info = snapshot.information ?? {};
  const prog = info.progression ?? {};
  const empty = (label) => `<div class="data-card"><p>${label}</p></div>`;
  const nav = (panel, label) =>
    `<button class="info-nav-button" type="button" data-info-panel="${panel}">${label} →</button>`;
  const row = (label, value) =>
    `<div class="data-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value ?? "—")}</span></div>`;
  const people = info.people ?? [];
  const displaySpecies = (id) => {
    const name = playerFacingLabel(id);
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  return {
    pokedex: () => {
      const dex = info.pokedex ?? { seen: 0, caught: 0, entries: [] };
      return `<div class="data-card"><h3>Il tuo Pokédex</h3>
        ${row("Avvistati", dex.seen)}${row("Catturati", dex.caught)}
        <p>Si registrano soltanto Pokémon che hai visto o catturato, non quelli di cui hai sentito parlare.</p></div>` +
        (dex.entries ?? []).map((entry) =>
          `<div class="data-card info-species"><img class="pokemon-icon" src="${spriteUrl(entry.speciesId, "icon")}" alt="">
            <div><h3>${escapeHtml(displaySpecies(entry.speciesId))}</h3>
            <small>${entry.status === "caught" ? "Catturato" : "Avvistato"}</small></div></div>`
        ).join("") + (!(dex.entries ?? []).length ? empty("Nessuna specie ancora incontrata.") : "");
    },
    people: () => people.length
      ? people.map((person) => {
          const portraitId = snapshot.assets?.characterPortraits?.[person.name];
          const portrait = portraitId
            ? `<img class="character-portrait" src="/characters/${encodeURIComponent(portraitId)}/portrait" alt="" loading="lazy">`
            : "";
          return `<div class="data-card info-person">${portrait}<div><h3>${escapeHtml(person.name)}</h3>
            <p>${escapeHtml(person.description)}</p></div></div>`;
        }).join("")
      : empty("Non hai ancora incontrato persone da annotare nel diario."),
    relations: () => people.length
      ? people.map((person) => `<div class="data-card"><h3>${escapeHtml(person.name)}</h3>
          ${row("Rapporto", ({
            Hostile: "Ostile", Distrustful: "Diffidente", Neutral: "Neutrale",
            Friendly: "Amichevole", Loyal: "Leale"
          })[person.relationship] ?? person.relationship)}</div>`).join("")
      : empty("Non hai ancora rapporti conosciuti."),
    reputation: () => {
      const reputation = info.reputation ?? {};
      return `<div class="data-card"><h3>Condotta</h3>
        ${row("Allineamento", reputation.alignment ?? "Non definito")}
        <p>Reputazione e allineamento sono diversi. I valori numerici restano nascosti.</p></div>` +
        (reputation.entries ?? []).map((entry) =>
          `<div class="data-card"><h3>${escapeHtml(playerFacingLabel(entry.name))}</h3>
            ${row("Reputazione", entry.label)}</div>`).join("") +
        (!(reputation.entries ?? []).length ? empty("La tua reputazione presso comunità e organizzazioni non è ancora conosciuta.") : "");
    },
    progress: () => {
      const trainer = snapshot.player ?? {};
      const roster = trainer.roster ?? [];
      return `<div class="data-card"><h3>Progressione Trainer</h3>
        ${row("Modulo", prog.moduleId)}${row("Livello", trainer.trainerLevel)}
        ${row("XP", prog.trainerXp == null ? "—" : prog.trainerNextLevelXp == null
          ? `${prog.trainerXp} · livello massimo` : `${prog.trainerXp} / ${prog.trainerNextLevelXp}`)}
        ${row("Limite Trainer nel modulo", prog.trainerCap)}
        ${row("Scelte di crescita in attesa", prog.pendingChoices)}
        ${row("Rango Circuito", prog.rank)}
        ${row("Punti Circuito", prog.circuitPoints)}</div>
        <div class="data-card"><h3>Progressione Pokémon</h3>
        ${row("Limite Pokémon nel modulo", prog.pokemonCap)}
        <p>L'esperienza non consente di superare il livello massimo del modulo.</p></div>` +
        roster.map((pokemon) => `<div class="data-card">
          <h3>${escapeHtml(pokemon.nickname ?? pokemon.name ?? pokemon.speciesId)}</h3>
          ${row("Livello", pokemon.level)}
          ${row("XP", pokemon.xp == null ? "—" : pokemon.nextLevelXp == null
            ? `${pokemon.xp} · livello massimo` : `${pokemon.xp} / ${pokemon.nextLevelXp}`)}
          ${row("Crescita in attesa", pokemon.pendingLevelUp || (pokemon.pendingAsiChoices ?? []).length ||
            (pokemon.pendingMoveChoices ?? []).length || (pokemon.pendingMoveLearning ?? []).length
              ? "Scelte disponibili nella schermata Pokémon" : "Nessuna")}</div>`).join("");
    },
    hall: () => {
      const hall = info.hallOfFame ?? [];
      return hall.length
        ? hall.map((entry) => `<div class="data-card"><h3>Campionato del Mondo · Edizione ${escapeHtml(entry.edition)}</h3>
          ${row("Campione", entry.champion)}${entry.runnerUp ? row("Finalista", entry.runnerUp) : ""}
          ${entry.playerChampion ? "<p>Hai conquistato questo titolo.</p>" : ""}</div>`).join("")
        : empty("Il Campionato del Mondo non ha ancora un vincitore registrato in questa carriera.");
    },
    codex: () => {
      const topics = [
        ["La carriera", "La storia procede attraverso scene, scelte, controlli e conseguenze persistenti. Alcune opportunità possono scadere mentre il mondo continua a muoversi."],
        ["Prove e caratteristiche", "Le prove seguono Pokémon 5e. Il risultato dei dadi e i modificatori del Trainer sono risolti dal motore secondo la difficoltà della situazione."],
        ["Combattimento", "Le lotte usano mosse, PP, HP, AC, iniziativa, condizioni e azioni di turno secondo Pokémon 5e. Le azioni disponibili sono mostrate durante il turno."],
        ["Pokémon e cattura", "Puoi avere al massimo sei Pokémon. Se catturi un settimo, scegli chi liberare definitivamente. I Pokémon ordinari selvatici sono catturabili secondo le regole della lotta."],
        ["Esperienza e limiti", "Trainer e Pokémon hanno progressioni separate, fino al livello 20. I moduli impongono limiti di livello distinti; consulta Progressione per quelli attivi."],
        ["Esplorazione e Pokédex", "La fauna dipende da luogo, orario e circostanze. Le voci Pokédex si sbloccano vedendo o catturando una specie, non ascoltando racconti."],
        ["Missioni e relazioni", "Le missioni possono essere attive, completate, fallite o scadute. I rapporti e la reputazione vengono mostrati con descrizioni qualitative, senza punteggi segreti."],
        ["Tempo e conseguenze", "Viaggi, riposi e decisioni possono far trascorrere il tempo. I Pokémon e il Trainer possono subire conseguenze permanenti, inclusa la morte nelle situazioni letali."],
        ["Campionato del Mondo", "Le qualificazioni e gli scontri portano alla finale. Vincere non conclude la carriera; le edizioni vinte o osservate finiscono nella Hall of Fame."]
      ];
      return `<div class="data-card"><h3>Guida alle regole</h3>
          <p>Consultabile fin dall'inizio e senza connessione. I calcoli completi sono applicati dal motore Pokémon 5e.</p></div>` +
        topics.map(([title, detail]) => `<div class="data-card"><h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(detail)}</p></div>`).join("") +
        '<div class="data-card"><p>Per approfondire il regolamento originale puoi consultare ' +
        '<a href="https://poke5e.app/" target="_blank" rel="noopener noreferrer">Pokémon 5e online</a> (opzionale).</p></div>';
    },
    shortcuts: () => ({
      trainer: nav("progress", "Progressione") + nav("pokedex", "Pokédex"),
      journal: nav("people", "Persone importanti") + nav("relations", "Relazioni") +
        nav("reputation", "Reputazione"),
      settings: nav("pokedex", "Pokédex") + nav("people", "Diario persone") +
        nav("relations", "Relazioni") + nav("reputation", "Reputazione") +
        nav("progress", "Progressione") + nav("hall", "Hall of Fame") +
        nav("codex", "Codex e regole")
    })
  };
}
