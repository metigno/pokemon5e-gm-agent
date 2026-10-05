# M01 — NARRATIVE AUDIT & SCREENPLAY MAPPING

**Module:** M01 — Le Prime Strade  
**Narrative status:** SYSTEM COMPLETE / NARRATIVE PASS REQUIRED  
**Mechanical status:** LOCKED by `M01_PRODUCTION_MAPPING.md`  
**Narrative authority:** `NARRATIVE_BIBLE.md` + `NPC_VOICE_BIBLE.md`

---

# 0. EXECUTIVE VERDICT

M01 is mechanically production-complete and already has several strong narrative foundations:

- second-person present is mostly established;
- player agency is usually preserved;
- ecology is grounded;
- no supervillain is forced into the module;
- time and world movement matter;
- losses remain legal;
- Blue is optional as a battle;
- the Five are structurally independent.

However, the current authored text still contains substantial **implementation prose** written to prove engine behavior.

Typical leakage includes:

- “onboarding”;
- “stato persistente”;
- “schedule”;
- “motore”;
- “resolver Pokémon 5e”;
- “nessuna opzione crea un party permanente”;
- “non è una boss fight”;
- explanations that a scene is not linear / not frozen / not scripted.

These statements are correct as design documentation but should not appear in final player-facing prose.

**Narrative goal:** keep every condition/effect/goto/mechanical result intact while replacing proof-of-system prose with scenes in which the player experiences those truths naturally.

---

# 1. DO NOT TOUCH DURING NARRATIVE PASS

Unless a separate bug is logged, the screenplay pass must not change:

- conditions;
- effects;
- DC;
- time costs;
- ecology requests;
- encounter IDs;
- opponent roster/levels;
- quest deadlines;
- rank logic;
- relationship deltas;
- competition state;
- scene ownership;
- module exit contract;
- M02 unlock requirements.

The default edit surface is:

- `title` where presentation benefits;
- stitch `text`;
- choice `text`;
- optional additional text-only variants that use already-supported state.

---

# 2. SEVERITY SCALE

## N0 — READY
Already close to final prose; polish only.

## N1 — LIGHT PASS
Mostly diegetic; remove a few explanatory lines.

## N2 — MEDIUM PASS
Good scene skeleton but voice, choice presentation or exposition needs meaningful rewrite.

## N3 — HEAVY PASS
Player-facing text exposes engine/design language or reads primarily like acceptance-test documentation.

---

# 3. BLOCK MAP

| Block | Primary implementation | Narrative status | Main task |
|---|---|---:|---|
| M1_00_RELEASE | `m01-release.json` | N3 | turn “free-roam proof” into a real release scene |
| M1_01_FIRST_ROAD | `m01-first-road.json` | N2/N3 | remove “corridor/clock/world frozen” meta explanations |
| M1_02_HOUNDOUR | `first-road.json` | N1/N2 | retain ecological encounter; strengthen fiction-mechanics-fiction |
| M1_03_FIRST_REAL_FORK | `m01-ginestre-crossroads.json` | N2 | remove selector-facing friend option and explanatory trial prose |
| M1_04_CITY | `m01-valedarsena-first-arrival.json` | N2 | strong city image; remove state/tutorial statements |
| M1_05_JOB_BOARD | same file | N1/N2 | make timing visible through Sera/board rather than system explanation |
| M1_06_FARM | `m01-farm-first-arrival.json` | N1/N2 | strong arrival; hide FRIEND_BEAT machinery |
| M1_07_WORLD_MOVES | `m01-world-moves.json` | N1/N2 | preserve grounded ecology; avoid premature conclusions |
| M1_08_BLUE | `m01-blue-enters.json` | N3 | convert Blue from design description into character performance |
| M1_09_FRIEND_BEAT | `m01-friend-beat-01.json` | N3 | remove selector/motor/schedule/party language; add distinct voices |
| M1_10_FIRST_OFFICIAL | Arena content | N2 | stage sanctioned match as event, not rules proof |
| M1_11_SECOND_POKEMON | `m01-ecology-opportunities.json` + city ecology | N3 outcomes | remove resolver/persistent-roster prose |
| M1_12_FIVE_ROADS | `m01-five-roads.json` | N3 | replace schedule/state explanations with messages/absence/evidence |
| M1_13_TRIAL_REGISTRATION | Arena content | N2 | explain legality diegetically and via UI, not engine vocabulary |
| M1_14_PROMOTION_TRIAL | Arena content | N2 | give Nara and venue identity; battle handoff purely diegetic |
| M1_15_TRIAL_RESULT | Arena/result content | N2/N3 | celebrate/record actual result without exit-contract prose |

---

# 4. M1_00 — RELEASE

## Current strengths
- three real directions;
- waiting is legal;
- no quest is forced.

## Current problem
The opening currently says things equivalent to:

- “l'ultima indicazione dell'onboarding”;
- “il mondo continua a muoversi”;
- “non hai ricevuto una missione principale”;
- “ignorare una pista non congela ciò che accade altrove”.

These are design truths stated directly.

## Screenplay target
Make the guided phase end physically.

Suggested beat structure:

1. Campus staff stop accompanying the group at the gate.
2. Noise from the Campus recedes.
3. Three routes are physically visible.
4. Other rookies leave in different directions.
5. Arena/Trial knowledge appears through signage, conversation or existing paperwork.
6. Agency returns with no narrator lecture.

## Tone
First real breath of independence.

---

# 5. M1_01 — FIRST ROAD

## Current strengths
- visible worker/rookie/wildlife layers;
- optional sparring;
- ecology does not auto-aggro;
- travel time matters.

## Rewrite targets

### “La strada non è un corridoio tra due scene”
This directly references story architecture.

Replace with evidence:
- cart tracks;
- workers;
- someone returning toward Campus;
- a Pokémon crossing a field;
- a rookie already on the move.

### “Il tempo di viaggio è già passato”
Let UI carry exact time and narration show changed position/light/activity.

### “nessun Pokémon cerca automaticamente lo scontro”
Show the animal ignoring the player unless approached.

## Rookie
The rookie can teach the world by being another beginner, not a tutorial NPC.

Give them:
- a destination;
- one small worry or goal;
- one reason to propose sparring.

---

# 6. M1_02 — HOUNDOUR

This is one of M1's best foundations because its central premise is already diegetic.

## Preserve
- animal agency;
- escape space;
- calm/flee/fight/capture routes;
- hidden DC before roll;
- no moral punishment for legal combat.

## Improve
After visible rolls, always convert result into:
- posture;
- distance;
- sound;
- movement;
- willingness to stay/flee.

Do not describe outcome as:
- branch success;
- escalation state;
- capture state.

Ranger callback later can interpret observed behavior without moral scoring.

---

# 7. M1_03 — FIRST REAL FORK

## Current strengths
- physical geography is clear;
- player can choose city/farm/exploration.

## Problems

### FRIEND_BEAT choice
Current choice can read like:
> “Incrocio uno degli altri Five che sta seguendo davvero questa strada.”

This tells the player an authored beat is available.

Better presentation:
- show a recognizable figure/voice/object first;
- or use a neutral action that naturally reveals the selected friend.

If the selector is only resolved after choice, use wording such as:
> “Mi fermo quando riconosco qualcuno più avanti.”

Then dispatch to the actual friend.

### Houndour review choices
Avoid “Ripenso a...” when it exists primarily to expose a callback.

Prefer an external prompt:
- tracks;
- ranger notice;
- similar animal behavior;
- the captured Houndour reacting.

---

# 8. M1_04 — VALEDARSENA FIRST ARRIVAL

## Strong material
The opening image is good:
- city arrives first as noise;
- road/services/arena/warehouses are spatially legible;
- the city feels busy without the player.

## Remove
> “Essere arrivato qui è già parte del tuo stato di viaggio...”

The discovery flag needs no narration.

The city being known afterward is obvious from play.

## Strengthen
Give Valedarsena recurring sensory identity:
- river smell / damp stone;
- carts and loading;
- arena announcements at a distance;
- trainers crossing ordinary workers.

This should become the first place that feels like a real hub rather than a list.

---

# 9. M1_05 — JOB BOARD

## Strong material
“DISPONIBILE / PRESO / CHIUSO” is excellent diegetic world-state presentation.

## Rewrite target
Current line:
> “La bacheca non è una lista congelata di missioni.”

Delete the system comparison.

Simply show:
- Sera removing a taken job;
- a timestamp;
- another trainer signing;
- a closing time.

The player will understand temporality without being told.

## Sera
Use `NPC_VOICE_BIBLE.md`:
- brisk;
- practical;
- not a quest herald.

---

# 10. M1_06 — FARM HERD HANDS

## Strong material
The arrival already works:
- sounds before visuals;
- rushed rope on gate;
- staff busy;
- nobody treats the protagonist as a destined solution.

This is close to target.

## Main problem
The friend option exposes system causality:
> “Uno degli altri Five è qui per un'attività propria...”

Instead, let the presence itself be the fiction.

Example pattern:
- the player hears Totodile;
- recognizes Koffing's smoke;
- sees Eevee beside a familiar bag;
- then the conditional choice names the actual friend.

No generic selector prose should reach the player.

---

# 11. M1_07 — WORLD MOVES

## Strong material
Elio's evidence-first role fits the project extremely well.

The line:
> “Elio Mar non ti chiede se hai una teoria: ti chiede cosa hai visto davvero.”

is close to final quality.

## Main risk
Do not reveal the complete “no single culprit / combined local pressure” explanation before the player has enough evidence.

Use state variants:

### Low evidence
Elio says there are multiple reports and asks for observations.

### Medium evidence
Patterns begin to overlap.

### High evidence
He can responsibly conclude that several pressures are combining.

## Important
“No villain” is a design rule, not a sentence the story must announce.

---

# 12. M1_08 — BLUE ENTERS

This needs one of the largest rewrites.

## Current problem
Current prose often explains Blue rather than letting Blue perform himself:

- he “wants to understand” the player;
- the text explains it is neither friendship nor hostility;
- it explains which types of interaction are valid;
- combat handoff may mention resolver authority.

## Target first impression
The player should infer Blue through:

- what he is timing;
- how he looks at Squirtle;
- which question he asks;
- what detail of another match he notices;
- whether he makes room for a real spar.

## Required Blue qualities
- young;
- serious;
- competitive;
- proud;
- not villainous;
- not automatically friendly;
- not a caricature.

## Dialogue pass
Use the Blue profile in `NPC_VOICE_BIBLE.md`.

His respect should emerge from increased precision and willingness to engage.

---

# 13. M1_09 — FRIEND_BEAT_01

This is currently the **highest-priority narrative rewrite**.

## Current leakage
The scene explicitly says variants of:

- “programma reale”;
- “uno degli altri Five”;
- “il motore ha già scelto”;
- “schedule”;
- “compatibilità”;
- “risultato recente”;
- “nessuna opzione crea un party permanente”.

All are implementation documentation.

## Target
The selector remains untouched but becomes invisible.

The player experiences only:

1. a plausible coincidence/overlap;
2. the selected friend doing something of their own;
3. a choice to interact or continue;
4. friend-specific voice;
5. a result that matters later.

## Friend differentiation
All four possible NPC friends must not share generic prose with swapped names.

Use:

- Luke: motion / improvisation;
- Mattew: sequence / preparation;
- Daniel: possibilities / reading;
- Edward: action / directness;
- Fab: patience / condition.

## Mandatory rule
If a member of the Five is the selected protagonist, no “seed personality” may leak into player narration.

---

# 14. M1_10 — FIRST OFFICIAL

## Narrative purpose
Teach the emotional difference between:
- informal spar;
- sanctioned career result;
- Promotion Trial.

Do it through:
- registration;
- venue procedure;
- opponent behavior;
- official result record.

Do not explain:
> “this is an official_match, not a promotion_trial.”

The interface and staff can show:
- “Sanctioned Rookie Match”;
- “Promotion: none”;
- result in career history.

## After loss
No soft reset.

The loss belongs to the player's story.

---

# 15. M1_11 — SECOND POKÉMON / ECOLOGY

## Strong encounter openings
Wooloo/Shinx scene setups are generally good:
- creatures are doing something before noticing the player;
- escape routes matter;
- not every contact is aggression.

## Critical rewrite
Outcome nodes currently contain direct engine prose such as:

- “La scena passa al risolutore Pokémon 5e”;
- “il risultato meccanico resta registrato”;
- “il nuovo Pokémon entra nello stato persistente del roster”;
- “la cattura è riuscita secondo le regole”.

These must be completely replaced.

## Target outcomes

### Wild win
Describe the defeated Pokémon and immediate environment.

### Wild loss
Describe what remains possible based on actual post-combat state; do not narratively heal.

### Capture
Describe:
- ball / rule-valid capture result;
- Pokémon's immediate state;
- player retrieving/holding the ball;
- concise UI roster update separately.

The prose does not need to defend the engine.

---

# 16. M1_12 — FIVE ROADS

This is the second largest rewrite after FRIEND_BEAT.

## Current problem
The scene repeatedly exposes:

- schedule;
- persistent world;
- “off-screen”;
- database ownership;
- state not belonging to player.

## Target
Show divergence through artifacts.

Possible delivery:

### Luke
A short message sent from the road, with wind/noise or a photo/location reference.

### Mattew
Arena booking board / direct message about Trial preparation.

### Daniel
Work badge / logistics message / missed call from warehouse shift.

### Edward
Farm staff mention that he has been training there repeatedly.

### Fab
Ranger departure list / direct message from the upper river route.

The player understands they are moving independently because they are visibly unavailable and busy.

No narrator explanation is needed.

---

# 17. M1_13 — TRIAL REGISTRATION

## Target
Registration should feel bureaucratic but real.

Use:
- roster check;
- rank card;
- slot availability;
- examiner call time.

If roster is illegal, UI/staff can state the exact missing requirement.

Avoid:
- “mechanically eligible”;
- “checkpoint state”;
- “registration flag”.

## Choice tone
- “Mi registro.”
- “Prima faccio curare la squadra.”
- “Non ancora.”
- “Controllo il roster.”

---

# 18. M1_14 — PROMOTION TRIAL

## Before battle
Establish:
- Nara Voss;
- Arena space;
- fixed two-Pokémon format;
- real stakes.

No boss framing.

## Nara
Professional and concise.

The player should understand that retry uses the same standard because Nara behaves consistently, not because the narrator explains “no scaling”.

## Battle handoff
End on physical readiness.

No “resolver” text.

---

# 19. M1_15 — RESULT

## Loss
Must communicate:
- result is official;
- Rank remains F;
- retry exists;
- no humiliation;
- world has continued.

Do not communicate this as an exit-contract checklist.

## Win
Rank E should feel like a genuine first career milestone, not a “module complete” popup.

Then the world reopens.

M02 access can appear through:
- new Circuit opportunities;
- travel/job access;
- a message;
- Rank-restricted postings.

## Mandatory beat incompleteness
If Blue/Friend/Five Roads requirements are still pending, the player should not see:
> “M1 cannot complete because flags are missing.”

They simply continue living in M1 space until those events occur naturally.

---

# 20. CROSS-CUTTING ISSUES

## 20.1 Meta-negation

Current text frequently proves what the game is **not**:

- not a corridor;
- not a boss fight;
- not frozen;
- not a forced quest;
- not a permanent party;
- not an automatic friendship.

Final prose should instead show what the world **is**.

Rule:

**Replace design negation with fictional evidence.**

## 20.2 Repeated thesis statements

“World continues without you” is a core feature, but repeating the thesis weakens it.

Show it differently:
- missing job;
- friend departed;
- match already happened;
- ranger report changed;
- shop delivery arrived;
- construction moved.

## 20.3 Mechanical disclaimer prose

Many outcome nodes currently defend correctness.

Tests already defend correctness.

The player text should be free to be fiction.

## 20.4 Generic NPC voice

M1 has structurally distinct NPCs but many lines currently share the same explanatory author voice.

Dialogue pass must make:
- Sera;
- Mira;
- Bram;
- Elio;
- Blue;
- Nara;
- each friend

immediately distinguishable.

---

# 21. SCREENPLAY PASS ORDER

Recommended order is based on narrative dependency, not block number.

## Pass A — Establish player-facing language
1. M1_00 Release
2. M1_01 First Road
3. M1_02 Houndour
4. M1_03 Fork

This defines the narrator.

## Pass B — Establish place / local cast
5. M1_04 City
6. M1_05 Job Board
7. M1_06 Farm
8. M1_07 World Moves

This defines Valedarsena and local realism.

## Pass C — Establish recurring character voices
9. M1_08 Blue
10. M1_09 Friend Beat
11. M1_12 Five Roads

This defines long-term character continuity.

## Pass D — Establish competition presentation
12. M1_10 First Official
13. M1_13 Registration
14. M1_14 Trial
15. M1_15 Result

## Pass E — Ecology outcome cleanup
16. M1_11 outcome branches across all reachable wild opportunities.

---

# 22. ACCEPTANCE GATE FOR M01 NARRATIVE COMPLETE

M01 may be marked **NARRATIVE COMPLETE** only when:

- no normal player-facing stitch mentions engine internals;
- no normal choice mentions selectors, flags, schedules or state machinery;
- no combat handoff mentions the resolver;
- no capture outcome explains persistence architecture;
- all Five have distinguishable NPC voices;
- Blue has a distinct voice;
- M1 local recurring NPCs have distinct voices;
- player interiority is never imposed;
- exact player dialogue appears only when the player selects it;
- world movement is shown diegetically;
- checks follow fiction → mechanics → fiction;
- wild encounters remain ecological rather than videogame prompts;
- Trial win and loss both receive authored, state-honest aftermath;
- all pre-existing mechanical regression tests remain green.

---

# 23. FIRST IMPLEMENTATION TARGET

The first JSON screenplay integration should be:

**M1_00_RELEASE → `bookgame/content/scenes/m01-release.json`**

Reason:

- small;
- mechanically stable;
- defines the narrator's opening voice;
- provides a style sample against which every later M1 rewrite can be reviewed.

After M1_00 passes narrative QA, proceed directly to M1_01.
