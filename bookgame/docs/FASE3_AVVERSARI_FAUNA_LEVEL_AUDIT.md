# FASE 3 — Avversari e fauna: censimento livelli

**Autorità:** `bookgame/docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, sezioni 10, 30–33, 44–45.  
**Ambito:** scene realmente caricate dal motore `bookgame/content/scenes/*.json`, generatori `bookgame/src/engine/ecology.mjs` / `bookgame/src/compiler/ecology-compiler.mjs`, risoluzione `bookgame/src/engine/bookgame-engine.mjs`.  
**Non include:** modifiche alla progressione dei Five (Fase 2), alle specie/roster mondiali (Fase 4), alle regole 5e, a Gigantamax o al bilanciamento Trainer XP (ancora TBD nel Source of Truth).

## Caps e interpretazione

| Modulo | Cap Pokémon giocatore | Livello massimo NPC statico ammesso per bilanciamento |
| --- | ---: | ---: |
| M01 | 5 | 6 |
| M02 | 6 | 7 |
| M03 | 8 | 9 |
| M04 | 10 | 11 |
| M05 | 12 | 13 |
| M06 | 14 | 15 |
| M07 | 16 | 17 |
| M08 | 18 | 19 |
| M09–M12 | 20 | 20 |

Il tetto `cap + 1` è un **controllo autoriale dei combattimenti statici**, non un algoritmo di scaling e non un nuovo limite per l'XP degli avversari. I boss possono essere più forti per roster, specie, abilità e regole Pokémon 5e, ma i picchi obbligatori di tre livelli sopra il cap sono stati corretti. Il cap del giocatore resta quello già stabilito nella Fase 1, senza adeguare artificialmente il suo livello.

**Livello Trainer NPC ≠ livello Pokémon.** `trainerId` e `opponentTrainerId` identificano il proprietario/avversario; `opponent.level` e `opponentBench[].level` sono i livelli dei Pokémon. Non ricavare mai `trainerLevel` da questi ultimi. I livelli Trainer degli NPC non risultano definiti per tutti gli incontri: non vengono inventati in questa fase.

## Incontri censiti per modulo

Censimento delle **155 scene JSON** effettive (comprese `first-road.json` e `intro-m01.json`), di **68 handoff di combattimento**: 61 descrittori statici e sette World handoff dinamici.

| Modulo | Incontri | Livelli statici originali / dopo Fase 3 | Note |
| --- | ---: | --- | --- |
| M01 | 26 | 1–5 / 1–5 | Tutor, Blue, Five, fauna, primo Trial. Tre percorsi dello stesso Houndour condividono ID. |
| M02 | 7 | 4–6 / 4–6 | Sparring Five Lv6; Rookie Cup Lv4; Trial E→D 4–5; corretto Pokémon del bracconiere |
| M03 | 4 | 7–8 / 7–8 | Regional Cup e Trial D→C |
| M04 | 9 | 8–10 / 8–10 | Fauna costiera Lv8; Upper Regional e Trial C→B Lv9–10 |
| M05 | 6 | 11–14 / 11–13 | Fauna montana Lv11; Trial B→A Lv12; Masters Lv13 |
| M06 | 5 | 15–17 / 14–15 | Continental Cup e Masters Lv14; Trial A→S Lv15 |
| M07 | 3 | 18–19 / 16–17 | World Qualifier Round 1 Lv16; finali e Last Chance Lv17 |
| M08 | 1 | 18 / 18 | Sparring Lucario; preparazione Mondiali |
| M09 | 3 | roster dinamico / invariato | Gironi Mondiali, tre match |
| M10 | 2 | roster dinamico / invariato | Ottavi e quarti Mondiali |
| M11 | 2 | roster dinamico / invariato | Semifinale e finale Mondiali |
| M12 | 0 | nessuno | Postgame/callback, nessun nuovo handoff di combattimento |

Il regolamento mondiale **Lv20 fisso** usa `regulatedWorldRoster()` e i roster persistenti dell'E5 in `competition-state.mjs`. Nessuna modifica, normalizzazione rispetto al giocatore o nuovo roster temporaneo in Fase 3.

## Modifiche puntuali

- `M2_POACHING_NETWORK_01`: rimossa la specie inesistente `trainer` (errata conflazione con il livello Trainer); l'operativo schiera **Houndour Lv5**, con `trainerId=PoacherCampo01` mantenuto. Essendo Pokémon di un Trainer, `opponentRegistered=true`; non catturabile.
- `A5_RANK_TRIAL_B_A`: squadra Lv13 → **Lv12**.
- `A5_MASTERS_ENTRY_MATCH`: squadra Lv14 → **Lv13**.
- `A6_CONTINENTAL_QF/SF/FINAL`: squadre Lv16 → **Lv14**.
- `M6_MASTERS_CIRCUIT_MATCH_01`: squadra Lv15 → **Lv14**.
- `A6_RANK_TRIAL_A_S`: squadra Lv17 → **Lv15**.
- `A7_WORLD_QUALIFIER_R1`: squadra Lv18 → **Lv16**.
- `A7_WORLD_QUALIFIER_FINAL`, `A7_LAST_CHANCE_FINAL`: squadre Lv19 → **Lv17**.

Tutte le specie e la composizione delle squadre già presenti sono preservate, tranne il Pokémon invalido del bracconiere; nessuna difficoltà si adatta in funzione dei livelli effettivamente raggiunti dal giocatore.

## Ecologia dinamica e catture

Il generatore `selectOrdinaryEncounter()` non tira un livello: seleziona **specie** dai pool ecologici canonici, verificando habitat, metodo, fascia oraria, rarità e classi di distribuzione. Il livello combattuto arriva dagli **handoff autoriali** nei `returnNodes` delle scene. Questo è distinto da un generatore di Pokémon con livelli casuali, che qui non esiste.

Gli incontri selvatici autoriali verificati includono M01 Lv1–3, M04 Lv8 e M05 Lv11, tutti entro il rispettivo cap. La compilazione ora rifiuta un combattimento catturabile il cui Pokémon superi il cap del modulo oppure sia registrato a un Trainer. Al termine del combattimento il runtime rifiuta un catturato sopra il cap di **stato** prima di aggiungerlo al roster; protegge anche da stati di combattimento alterati o salvataggi obsoleti.

Nessuna specie leggendaria viene aggiunta ai pool ordinari. Non sono stati modificati habitat, probabilità, specie, mappe o formule di cattura Pokémon 5e.

## Regressioni e limiti

La suite `tests/fase3-encounter-levels.test.mjs` percorre tutti i file di scena reali e verifica:

- tutti i Pokémon statici con livello valido 1–20 e nessun falso Pokémon `trainer`;
- bilanciamento M01–M08 massimo cap+1 e dieci fight target esatti;
- sette Mondiali M09–M11 che usano roster dinamici senza squadre provvisorie negli handoff;
- livello degli incontri catturabili entro il cap, senza cattura di Pokémon registrati;
- blocco di una cattura sopra il cap al runtime, con stato d'origine invariato;
- campionamento ecologico che seleziona specie, senza creare livelli fittizi.

La verifica statica non sostituisce una campagna E2E completa né una simulazione probabilistica dei duelli Pokémon 5e. Validare `npm run validate:story` e `npm test` con CI prima del merge.
