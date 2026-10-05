# P5E LIBROGAME — M11 PRODUCTION MAPPING

**Module:** M11 — Per Diventare Campione  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M11_PER_DIVENTARE_CAMPIONE_MODULE_DESIGN.md`  
**Locked authored budget:** **3,500 stitches / 1,600 player choices**  
**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are shared infrastructure from M1. No module-specific replacement engine is allowed.

---

# 1. MACRO GRAPH

```text
M11_00_FINAL_FOUR_LOCK
   ↓
M11_01_REI_THREAD
   ↓
M11_02_SF_PREP
   ↓
M11_03_WORLD_SF
   ↓
M11_04_OTHER_SF
   ↓
M11_05_FRIEND_BEAT_11
   ↓
M11_06_FINAL_PREP
   ↓
M11_07_WORLD_FINAL
   ↓
M11_08_CHAMPIONSHIP_OUTCOME
```

The spine is production ordering, not forced linear play. Actual legal branches depend on world and competition state.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M11_00_FINAL_FOUR_LOCK | lock dei quattro semifinalisti reali e del bracket | 305 | 140 | PLANNED |
| M11_01_REI_THREAD | Rei come competitor reale, mai finalista garantito | 359 | 164 | PLANNED |
| M11_02_SF_PREP | preparazione con stato squadra persistente | 305 | 140 | PLANNED |
| M11_03_WORLD_SF | semifinale reale, single elimination | 521 | 238 | PLANNED |
| M11_04_OTHER_SF | risoluzione dell'altra semifinale senza plot armor | 359 | 164 | PLANNED |
| M11_05_FRIEND_BEAT_11 | amico nel Final Four o ultimo contatto plausibile | 521 | 238 | PLANNED |
| M11_06_FINAL_PREP | preparazione finale senza reset gratuito | 305 | 139 | PLANNED |
| M11_07_WORLD_FINAL | finale reale: Champion is whoever actually wins | 520 | 238 | PLANNED |
| M11_08_CHAMPIONSHIP_OUTCOME | registrare campione/finalista/eliminato e aprire WORLD_EXIT | 305 | 139 | PLANNED |
| **TOTAL** |  | **3,500** | **1,600** | |

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_SF`
- `WORLD_FINAL`

Competition results must come from E5/actual bracket state. Content cannot rewrite opponent identity or result for drama.

---

# 4. ENGINE REUSE CONTRACT

- E1 Conditions for prerequisites.
- E2 Time/Calendar for schedules, recovery and event windows.
- E3 Quest State for unresolved/failed/ignored content.
- E4 NPC/Relationships for Anchor/Four state.
- E5 Competition for every official World result.
- E6 Living World for off-screen results and callbacks.
- E7 Ecology where post-event exploration exposes fauna.

---

# 5. BLOCK CONTRACTS

## M11_00_FINAL_FOUR_LOCK

**Purpose:** lock dei quattro semifinalisti reali e del bracket.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_01_REI_THREAD

**Purpose:** Rei come competitor reale, mai finalista garantito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_02_SF_PREP

**Purpose:** preparazione con stato squadra persistente.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_03_WORLD_SF

**Purpose:** semifinale reale, single elimination.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_04_OTHER_SF

**Purpose:** risoluzione dell'altra semifinale senza plot armor.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_05_FRIEND_BEAT_11

**Purpose:** amico nel Final Four o ultimo contatto plausibile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_06_FINAL_PREP

**Purpose:** preparazione finale senza reset gratuito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_07_WORLD_FINAL

**Purpose:** finale reale: Champion is whoever actually wins.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_08_CHAMPIONSHIP_OUTCOME

**Purpose:** registrare campione/finalista/eliminato e aprire WORLD_EXIT.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.


# 6. STATE OWNERSHIP

Primary state: `m11_complete`, Rei callback state, `friend_beat_11_*`, module outcome state and canonical World history. HP/PP/status/inventory/roster/rank/bracket remain engine-owned.

---

# 7. REGRESSION FAMILIES

Validate:

- weakest and strongest legal entry states;
- Anchor present/absent where bracket allows;
- at least two Friend Beat eligibility patterns;
- every legal win/loss/elimination route;
- save/reload after durable results;
- no duplicate results on re-entry;
- actual opponent identity preserved;
- no narrative heal/reset;
- exit contract cannot be forced.

---

# 8. EXIT CONTRACT

- `world_finalist/world_champion coerenti con risultati reali`;
- `current_world_champion=actual winner`;
- `friend_beat_11_complete=true`;
- `WORLD_EXIT disponibile`;
- `m12_unlocked=true`;

---

# 9. PRODUCTION RULE

Every counted choice must change route, information, time, risk, relationship, state, combat/encounter state or future access. Do not pad budgets.
