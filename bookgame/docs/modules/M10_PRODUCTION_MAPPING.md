# P5E LIBROGAME — M10 PRODUCTION MAPPING

**Module:** M10 — Nessuna Seconda Possibilità  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M10_NESSUNA_SECONDA_POSSIBILITA_MODULE_DESIGN.md`  
**Purpose:** production map for converting M10 into validated offline story content  
**Locked authored budget:** **4,000 stitches / 2,000 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M10_00_R16_BRACKET
   ↓
M10_01_SILAS_THREAD
   ↓
M10_02_R16_PREP
   ↓
M10_03_WORLD_R16
   ↓
M10_04_R16_AFTERMATH
   ↓
M10_05_FRIEND_BEAT_10
   ↓
M10_06_QF_PREP
   ↓
M10_07_WORLD_QF
   ↓
M10_08_QF_AFTERMATH
   ↓
M10_09_MODULE_OUTCOME
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M10_00_R16_BRACKET | lock dell'avversario dagli incroci reali | 367 | 184 | IMPLEMENTED / VALIDATION PENDING |
| M10_01_SILAS_THREAD | Silas compare solo dove il bracket o il venue lo rendono plausibile | 367 | 184 | IMPLEMENTED / VALIDATION PENDING |
| M10_02_R16_PREP | preparazione senza reset di HP/condizioni non consentiti | 312 | 156 | IMPLEMENTED / VALIDATION PENDING |
| M10_03_WORLD_R16 | ottavo reale, single elimination | 532 | 266 | IMPLEMENTED / VALIDATION PENDING |
| M10_04_R16_AFTERMATH | eliminazione oppure avanzamento e risultati degli altri | 367 | 183 | IMPLEMENTED / VALIDATION PENDING |
| M10_05_FRIEND_BEAT_10 | corsa dell'amico visibile; Player vs Friend solo se bracket | 532 | 266 | PLANNED |
| M10_06_QF_PREP | pressione Top8 e stato roster reale | 312 | 156 | PLANNED |
| M10_07_WORLD_QF | quarto reale, single elimination | 532 | 266 | PLANNED |
| M10_08_QF_AFTERMATH | eliminazione oppure Final Four | 367 | 183 | PLANNED |
| M10_09_MODULE_OUTCOME | handoff M11 o WORLD_EXIT | 312 | 156 | PLANNED |
| **TOTAL** |  | **4,000** | **2,000** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_R16`
- `WORLD_QF`

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

## M10_00_R16_BRACKET

**Purpose:** lock dell'avversario dagli incroci reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_01_SILAS_THREAD

**Purpose:** Silas compare solo dove il bracket o il venue lo rendono plausibile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_02_R16_PREP

**Purpose:** preparazione senza reset di HP/condizioni non consentiti.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_03_WORLD_R16

**Purpose:** ottavo reale, single elimination.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_04_R16_AFTERMATH

**Purpose:** eliminazione oppure avanzamento e risultati degli altri.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_05_FRIEND_BEAT_10

**Purpose:** corsa dell'amico visibile; Player vs Friend solo se bracket.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_06_QF_PREP

**Purpose:** pressione Top8 e stato roster reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_07_WORLD_QF

**Purpose:** quarto reale, single elimination.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_08_QF_AFTERMATH

**Purpose:** eliminazione oppure Final Four.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_09_MODULE_OUTCOME

**Purpose:** handoff M11 o WORLD_EXIT.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 5A. CYCLE 1 IMPLEMENTATION LOCK — M10_00–M10_04

Cycle 1 converts the Round-of-16 half of M10 into runtime content while preserving the locked authored-surface manifest (**4,000 stitches / 2,000 choices**) and the module-wide logical trajectory (**160 nodes / 352 meaningful choices**).

**Cycle 1 logical surface:** **78 nodes / 171 meaningful choices** exactly.  
**Residual M10 budget after Cycle 1:** **82 nodes / 181 meaningful choices** for M10_05→M10_09.

## M10_00_R16_BRACKET

**Reuse class:** ADAPT / E5 EXTENSION

**Source archetypes:**
- R37_MULTI_ROUND_TOURNAMENT_LIFECYCLE
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R21_MODULE_HANDOFF
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** consumes the immutable E5 Top16 produced by M09 and constructs the real Round-of-16 bracket from group positions. Pairing is structural (A1-B2, B1-A2, C1-D2, D1-C2, E1-F2, F1-E2, G1-H2, H1-G2); authored text cannot substitute an opponent.

**Implementation lock:** scene `m10-r16-bracket` contains **15 nodes / 32 meaningful choices**. E5 opens WORLD_R16 idempotently, stores exactly eight matches, one player match and the actual player opponent without changing M09 Top16 state.

## M10_01_SILAS_THREAD

**Reuse class:** ADAPT

**Source archetypes:**
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Silas Crowe is available as the M10 Anchor only from his actual post-groups state. If he is not in the Top16 he is never reinserted; if present, physical contact still requires E4 schedule/location overlap.

**Implementation lock:** scene `m10-silas-thread` contains **15 nodes / 32 meaningful choices**. Anchor status grants no knockout protection and does not change the bracket.

## M10_02_R16_PREP

**Reuse class:** REUSE / ADAPT

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** knockout preparation reads the real post-groups/post-service roster while keeping the R16 pairing immutable. Informational review never heals or rebuilds the player team.

**Implementation lock:** scene `m10-r16-prep` contains **12 nodes / 27 meaningful choices**. Time-consuming preparation advances E2 time but preserves HP, PP, status, injury, inventory and roster unless an actual external subsystem changes them.

## M10_03_WORLD_R16

**Reuse class:** ADAPT / E5 EXTENSION

**Source archetypes:**
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R06_COMBAT_HANDOFF
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R37_MULTI_ROUND_TOURNAMENT_LIFECYCLE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** the Pokémon 5e combat handoff resolves its opponent, trainer id and official match id dynamically from the E5 knockout bracket. The authored scene never hardcodes a trainer identity.

**Implementation lock:** scene `m10-world-r16` contains **21 nodes / 47 meaningful choices**. A win or loss is written once into the real R16 match and canonical competition history; replay after resolution is hidden/rejected.

## M10_04_R16_AFTERMATH

**Reuse class:** ADAPT / E5 EXTENSION

**Source archetypes:**
- R37_MULTI_ROUND_TOURNAMENT_LIFECYCLE
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** after the player's real R16 result, E5 deterministically resolves the other seven matches, locks exactly eight quarterfinalists and derives four QF pairings. Friends and Anchors receive no result protection.

**Implementation lock:** scene `m10-r16-aftermath` contains **15 nodes / 33 meaningful choices**. A player loss advances the actual opponent and keeps the player eliminated; a win places the player in the Top8 and derives the QF opponent from the adjacent R16 winner.

## E5 WORLD_R16 extension

Cycle 1 extends the existing Competition subsystem rather than introducing a parallel knockout engine:

- persistent `competition.world.knockout` state;
- immutable input = M09 `competition.world.top16`;
- eight Round-of-16 matches generated from final group positions;
- one dynamic Pokémon 5e player combat;
- seven deterministic off-screen R16 results using the career/draw seed;
- exactly eight unique Top8 participants;
- four derived QF pairings;
- player QF opponent exists only when the player actually wins the R16;
- independent knockout opponent-roster cache under `WORLD_KNOCKOUT_L20`;
- save/reload and repeated resolution are idempotent;
- no Anchor, Friend or named rival receives plot armor.

## Cycle 1 validation contract

- exact runtime budget: **78 nodes / 171 meaningful choices**;
- all authored Cycle-1 nodes reachable;
- no zero-incoming padding nodes;
- M09 Top16 remains immutable;
- bracket contains exactly eight matches / sixteen unique participants;
- player appears exactly once;
- opponent is derived from group positions, never authored fanservice;
- Silas physical contact requires actual Top16 presence and schedule/location overlap;
- R16 combat uses the existing Pokémon 5e bridge and records one official result;
- player loss sets real World elimination and advances the actual opponent;
- player win remains in the real Top8;
- the other seven R16 matches resolve once through E5;
- Top8 contains exactly eight unique winners;
- QF bracket contains four derived matches;
- no narrative heal/reset occurs in preparation or aftermath;
- save/reload preserves bracket, roster, official history and Top8.

**No R39 candidate is required.** Library V2 R01→R38 remains sufficient; the only generic engine work is the missing E5 World knockout lifecycle.

Do **not** promote the completed Library V2 baseline beyond **M01→M09** until the remaining M10_05→M10_09 blocks are implemented and the full M10 exit contract is validated.

---

# 6. STATE OWNERSHIP

Primary state families:

- `m10_complete`;
- Anchor state for Silas Crowe;
- `friend_beat_10_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M10 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M10 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `world_eliminated=true oppure world_qf_won=true`;
- `friend_beat_10_complete=true`;
- `actual bracket/history persistente`;
- `m11_unlocked se QF vinto`;
- `m12_unlocked se eliminato`;

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
