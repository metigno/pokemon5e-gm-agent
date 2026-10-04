# ASTERIA CIRCUIT RANK — HARD PROGRESSION SYSTEM

## Intento

Asteria **non usa medaglie come progressione principale**.

La carriera usa un Circuit Rank registrato sulla Trainer License:

**F → E → D → C → B → A → S → Qualificazione Mondiale**

Ogni promozione richiede una **Promotion Trial** scripted: una sfida Pokémon ufficiale, importante come una Palestra classica, ma senza badge o medaglie. La vittoria aggiorna il rank.

## Hard gate geografico

**Non si entra nella fascia successiva finché non si vince la Promotion Trial richiesta.**

Il blocco esiste anche nella fiction tramite checkpoint di Lega, controlli licenza, ranger gate, ferrovia, traghetti, tunnel, permessi e restrizioni di sicurezza.

Non creare scorciatoie che annullano la progressione.

Il player può esplorare liberamente tutto ciò che il rank corrente ha già sbloccato, fare side quest, catturare, allenarsi e ritentare la prova.

## Rank

| Rank | Nome | Funzione |
|---|---|---|
| F | Licenziato | fascia iniziale |
| E | Locale | prima espansione |
| D | Regionale | circuito regionale |
| C | Avanzato | aree regionali difficili |
| B | Interregionale | tratte interregionali |
| A | Master | contenuti élite |
| S | Candidato Mondiale | accesso al World Qualifier |

Rank S **non significa qualificato al Mondiale**.

## Promotion Trials

Regole comuni:
- battaglie reali Pokémon 5e;
- dadi onesti e risultato non predeterminato;
- roster ufficiale fissato per la fascia, senza scaling invisibile;
- sconfitta = nessuna promozione e fascia successiva ancora bloccata;
- le prove F→S sono ritentabili dopo recupero/preparazione;
- la vittoria crea un checkpoint durevole;
- anche gli NPC autonomi devono superare le proprie prove per avanzare.

## Circuit Points

I `circuit_points` restano una classifica parallela per seeding, reputazione, inviti, ranking e tiebreak.

Non possono comprare un rank, saltare una Promotion Trial o sbloccare la mappa.

## World Qualifier

Rank S sblocca Meridiana e il World Qualifier.

Per raggiungere il World Championship serve un vero risultato di qualificazione. Se il player perde, resta Rank S; una Last Chance esiste solo se calendario ed eligibility lo permettono, altrimenti si aspetta il ciclo successivo.

## Trainer Level vs Rank

Trainer Level = progressione Pokémon 5e.

Circuit Rank = progressione competitiva/geografica Asteria.

Nessuno dei due sostituisce l'altro.

## Autorità

- `campaign/world/RANK_PROGRESSION_SYSTEM.md`
- `campaign/world/RANK_CHECKPOINTS.json`
- `campaign/world/REGION_MAP.json`
- `campaign/events/MAIN_EVENT_GRAPH.json`
