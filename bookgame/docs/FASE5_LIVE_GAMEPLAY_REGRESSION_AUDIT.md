# FASE 5 — Audit delle regressioni dinamiche prima del rilascio

**Ambito:** Pokémon 5e Digital Bookgame, branch canonico `bookgame-canonical`.

**Autorità:** [P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md](P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md) (progressione, ecologia, catture, combattimento, salvataggi) e [ENCOUNTER_LEVEL_BALANCE_M01_M12.md](ENCOUNTER_LEVEL_BALANCE_M01_M12.md) (FASE 3).

**PR di verifica:** [#87](https://github.com/metigno/pokemon5e-gm-agent/pull/87).

## Metodo

Questa fase controlla l'integrazione **scena realmente consumata dal runtime → handoff → motore Pokémon 5e 2024 → esito → XP/stato → salvataggio → ricarica**. Non altera nodi, scelte, `conditions`, `goto`, `effects`, conseguenze narrative, regole di morte, morale, roster dei Five o roster persistenti del Mondiale.

L'analisi confronta i test di regressione esistenti con nuovi test dinamici che eseguono azioni del combattimento e di cattura reali. I casi deterministici preparano una situazione di combattimento con un avversario a **1 HP**, ma **non simulano direttamente** `outcome=win`: l'esito deriva da una mossa del motore di combattimento con dadi controllati.

## Matrice di controllo

| Area | Scenario di test | Verifica |
| --- | --- | --- |
| XP / vittoria | `phase5-live-regressions.test.mjs`: M01 Houndour, attacco reale `ember`, KO | Solo i Pokémon partecipanti ricevono l'XP del Pokémon realmente sconfitto; nessun premio duplicato; passaggio al nodo `combat_win` |
| Caps M01–M12 | `pokemon-xp-caps.test.mjs` + test vittoria M01 al cap | XP bloccata al checkpoint senza accumulo per i moduli successivi; Trainer XP indipendente |
| Salvataggio durante la battaglia | SaveStore prima dell'attacco, reload, esecuzione attacco, save, nuovo reload | HP, PP, azioni, stato battaglia, roster, cronologia XP e nodo di ritorno persistenti |
| NPC Five | Sparring reale `m02-friend-beat-02`: Mattew | Trainer NPC Lv3 e Eevee Lv6 conservati come dati **distinti**, Pokémon marcato registrato, stessa distinzione dopo reload |
| Milestone NPC | Cinque protagonisti, salto del salvataggio da M01 a M09 | Tutti i quattro amici NPC hanno sei acquisizioni legali e livelli entro cap; nessuna doppia acquisizione/evoluzione dopo sync e reload |
| Avversari e fauna M01–M12 | Tutti i file `bookgame/content/scenes/*.json` | Gli handoff statici generano veri combattenti Pokémon 5e con HP/mosse validi; i sette incontri Mondiali dinamici **non** vengono convertiti in roster statici |
| Ecologia e cattura | Scelta giocabile `m01-farm-first-arrival`, pool compilato, tentativo di cattura effettivo | Livello fauna determinato dalla zona, confermato nel combat; una Poké Ball è consumata, il catturato si aggiunge una volta al roster e resta entro cap; cattura non attribuisce XP da vittoria |
| Campagna e tornei | Suite già esistente `runtime-rc-persistent-e2e.test.mjs` e `encounter-level-balance.test.mjs` | Traversata sceneggiata M01→M12, rami di esito Mondiali, livelli prove/tornei, roster NPC e catture |
| Motore, UI e compatibilità | Suite `combat.test.mjs`, `trainer-ui-integration-e2e.test.mjs`, `ui-server-smoke.test.mjs` e test di salvataggio | Compatibilità con le meccaniche 2024 e con i percorsi runtime esistenti |

## Bug effettivo scoperto e corretto

Il passaggio al combattimento leggeva il livello Trainer NPC da `npcs[id].trainerLevel`, mentre il modello persistente dei Five e degli altri NPC usa `npcs[id].trainer.trainerLevel`. In assenza del valore flat, l'handoff riportava `null` nonostante il livello fosse conosciuto.

La FASE 5 legge prima il livello dal Trainer persistente, mantenendo il fallback legacy flat. Riconosce inoltre gli sparring con `opponent.type === "trainer"` e `trainerId` come Pokémon registrati, senza cambiare la specie o il livello Pokémon.

## Risultati CI verificati

- **Workflow:** [Bookgame Tests — run 37770825647](https://github.com/metigno/pokemon5e-gm-agent/actions/runs/37770825647), PR #87.
- **Test:** **1.601 passati / 1.601 totali**, **0 falliti**.
- **Gate:** verifica sintassi, validazione del grafo narrativo e test Bookgame tutti **PASS**.
- La suite include i nuovi sei scenari FASE 5, insieme alle regressioni precedenti delle fasi 1–4.

## Limiti dichiarati

I test sono reali ma **deterministici**: non equivalgono a un playtest umano completo di tutte le diramazioni, di ogni combinazione di classi/Pokémon, di ogni incontro casuale o della qualità tattica su una campagna di molte ore. Gli esiti dei Mondiali e gli archi narrativi vengono esercitati dalle suite preesistenti, non reinterpretati o garantiti dalle sei nuove prove.

Il `Source of Truth` mantiene l'assegnazione numerica di **Trainer XP e dei relativi cap** come tema separato (sezione 44): la FASE 5 verifica che l'XP Pokémon non la sovrascriva, ma non inventa cap Trainer non canonici.

Nessuna nuova mappa, luogo, Pokémon, quest o regola di progressione è introdotta.
