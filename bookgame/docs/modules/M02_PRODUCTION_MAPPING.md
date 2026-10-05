# P5E LIBROGAME — M02 PRODUCTION MAPPING

**Module:** M02 — Sotto la Nebbia  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M02_SOTTO_LA_NEBBIA_MODULE_DESIGN.md`  
**Purpose:** production map for converting M2 into validated offline story content  
**Locked authored budget:** **5,700 stitches / 3,700 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M2_00_RANK_E_HANDOFF
   ↓
M2_01_MISTWOOD_ENTRY
   ↓
M2_02_CAPTURE_SIGNS
   ↓
M2_03_BORGO_SALICE
   ↓
M2_04_N_ENTERS
   ↓
M2_05_RANGER_THREAD
   ↓
M2_06_MARSH_APPROACH
   ↓
M2_07_POACHING_NETWORK
   ↓
M2_08_FRIEND_BEAT_02
   ↓
M2_09_ROOKIE_INVITATIONAL
   ↓
M2_10_CRISIS_MOVES
   ↓
M2_11_NETWORK_OUTCOME
   ↓
M2_12_TRIAL_REGISTRATION
   ↓
M2_13_PROMOTION_TRIAL_E_D
   ↓
M2_14_TRIAL_RESULT
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M2_00_RANK_E_HANDOFF | ereditare integralmente M1 e aprire la fascia Rank E | 286 | 186 | PLANNED |
| M2_01_MISTWOOD_ENTRY | primo ingresso a Bosco Bruma, viaggio, nebbia e fauna contestuale | 286 | 186 | PLANNED |
| M2_02_CAPTURE_SIGNS | indizi di cattura illegale senza rendere il crimine automaticamente evidente | 337 | 218 | PLANNED |
| M2_03_BORGO_SALICE | hub locale, Ranger, servizi, voci e Sala Verde | 336 | 218 | PLANNED |
| M2_04_N_ENTERS | introduzione causale di N e primo contrasto etico | 336 | 218 | PLANNED |
| M2_05_RANGER_THREAD | collegare conseguenze Ranger/M1 alle nuove anomalie | 336 | 218 | PLANNED |
| M2_06_MARSH_APPROACH | accesso progressivo verso Palude Mirto e aumento del rischio | 336 | 218 | PLANNED |
| M2_07_POACHING_NETWORK | rami investigazione/intervento/evitamento con stato reale | 488 | 317 | PLANNED |
| M2_08_FRIEND_BEAT_02 | interazione concreta con uno dei Four selezionato da schedule e stato | 488 | 317 | PLANNED |
| M2_09_ROOKIE_INVITATIONAL | Rookie Invitational opzionale e deadline reale | 336 | 218 | PLANNED |
| M2_10_CRISIS_MOVES | A2_CRISIS_ESCALATES e conseguenze se il player ritarda | 336 | 218 | PLANNED |
| M2_11_NETWORK_OUTCOME | registrare esito resolved/partial/ignored/escalated senza reset | 437 | 284 | PLANNED |
| M2_12_TRIAL_REGISTRATION | eligibility E→D alla Sala Verde, roster legale e preparazione | 437 | 284 | PLANNED |
| M2_13_PROMOTION_TRIAL_E_D | checkpoint RANK_E_TO_D, Singles roster ufficiale 3 | 488 | 316 | PLANNED |
| M2_14_TRIAL_RESULT | loss/retry o Rank D; chiusura M2 senza cancellare il mondo | 437 | 284 | PLANNED |
| **TOTAL** |  | **5,700** | **3,700** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `A2_LOCAL_PROBLEM`
- `A2_FRIEND_NEWS`
- `A2_ROOKIE_CUP`
- `A2_RANK_TRIAL_E_D`
- `A2_CRISIS_ESCALATES`

Bindings must call the existing event/competition state. Do not create look-alike quest flags for Rank, brackets, qualification or World results.

---

# 4. ENGINE REUSE CONTRACT

- **E1 Conditions:** reuse for rank, roster, relationship, world and bracket prerequisites.
- **E2 Time/Calendar:** reuse for travel, deadlines, service hours, recovery and event windows.
- **E3 Quest State:** reuse for active/completed/failed/ignored/expired content.
- **E4 NPC/Relationships:** reuse for Anchor/Four schedules, relationship state and encounter plausibility.
- **E5 Competition:** reuse for official matches, trials, cups, qualifier and World stages.
- **E6 Living World:** reuse for off-screen progress, unresolved problems and independent NPC careers.
- **E7 Ecology:** reuse for biome/time/method encounter selection and fauna state.

A content gap is not permission to implement a second engine.

---

# 5. BLOCK CONTRACTS

## M2_00_RANK_E_HANDOFF

**Purpose:** ereditare integralmente M1 e aprire la fascia Rank E.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_01_MISTWOOD_ENTRY

**Purpose:** primo ingresso a Bosco Bruma, viaggio, nebbia e fauna contestuale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_02_CAPTURE_SIGNS

**Purpose:** indizi di cattura illegale senza rendere il crimine automaticamente evidente.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_03_BORGO_SALICE

**Purpose:** hub locale, Ranger, servizi, voci e Sala Verde.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_04_N_ENTERS

**Purpose:** introduzione causale di N e primo contrasto etico.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_05_RANGER_THREAD

**Purpose:** collegare conseguenze Ranger/M1 alle nuove anomalie.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_06_MARSH_APPROACH

**Purpose:** accesso progressivo verso Palude Mirto e aumento del rischio.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_07_POACHING_NETWORK

**Purpose:** rami investigazione/intervento/evitamento con stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_08_FRIEND_BEAT_02

**Purpose:** interazione concreta con uno dei Four selezionato da schedule e stato.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_09_ROOKIE_INVITATIONAL

**Purpose:** Rookie Invitational opzionale e deadline reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_10_CRISIS_MOVES

**Purpose:** A2_CRISIS_ESCALATES e conseguenze se il player ritarda.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_11_NETWORK_OUTCOME

**Purpose:** registrare esito resolved/partial/ignored/escalated senza reset.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_12_TRIAL_REGISTRATION

**Purpose:** eligibility E→D alla Sala Verde, roster legale e preparazione.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_13_PROMOTION_TRIAL_E_D

**Purpose:** checkpoint RANK_E_TO_D, Singles roster ufficiale 3.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_14_TRIAL_RESULT

**Purpose:** loss/retry o Rank D; chiusura M2 senza cancellare il mondo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m2_complete`;
- Anchor state for N;
- `friend_beat_02_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M2 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M2 Friend Beat | persist selected friend/type/result | later modules can reference it |

---

# 8. REGRESSION FAMILIES

At minimum validate:

- entry from the weakest legal prior-module state;
- entry from a heavily explored prior-module state;
- Anchor encountered and Anchor not yet encounterable where optional;
- at least two different eligible friends for FRIEND_BEAT;
- relevant competition win/loss/elimination branches;
- ignoring the main conflict long enough for E6 progression;
- optional competition skipped where legal;
- save/reload after each durable resolution;
- repeated scene entry does not duplicate rewards/results;
- exit contract cannot be forced through hidden choices;
- no state reset at module boundary.

---

# 9. EXIT CONTRACT

- `current_rank=D`;
- `n_met=true`;
- `friend_beat_02_complete=true`;
- `poaching_network_state è persistente (resolved/partial/ignored/escalated)`;
- `m03_unlocked=true`;

The next module unlock is a consequence of the canonical state, not a narrative teleport.

---

# 10. PRODUCTION ORDER

1. lock location/event/state reads;
2. author open exploration and world-pressure blocks;
3. wire Anchor and FRIEND_BEAT variants;
4. wire optional competition;
5. wire mandatory gate/World stage when applicable;
6. add save/reload and idempotence tests;
7. run cross-module regression from at least two distinct prior histories;
8. mark individual blocks COMPLETE only after runtime evidence.

---

# 11. PRODUCTION RULE

Do not pad the budget. Every stitch must establish place/character/world state, provide information, react to prior state, resolve consequence, support meaningful choice, or create a callback. Every counted choice must change route, information, time, risk, relationship, state, combat/encounter state or future access.
