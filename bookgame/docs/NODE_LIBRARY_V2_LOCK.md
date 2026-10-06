# P5E LIBROGAME — NODE LIBRARY V2 LOCK

**Status:** LOCKED BASELINE FOR M05→M12 AUTHORING  
**Production branch reviewed:** `m7-00-04-work`  
**Runtime-validated corpus:** M01 + M02 + M03 + M04 + M05 + M06 + M07  
**Latest runtime evidence:** M06 — 220 / 484; M07 — 210 / 462; M7 final CI 1,158 passed / 0 failed  
**Catalog:** `bookgame/docs/NODE_REUSE_CATALOG.md`

---

# 1. COMPLETE MODULE BASELINE

| Module | Logical nodes | Meaningful choices |
|---|---:|---:|
| M01 | 202 | 463 |
| M02 | 189 | 409 |
| M03 | 250 | 594 |
| M04 | 253 | 639 |
| M05 | 240 | 528 |
| M06 | 220 | 484 |
| M07 | 210 | 462 |
| **TOTAL** | **1,564** | **3,579** |

Latest final M5 compiler validation reported:

- 71 scenes;
- 1,134 nodes;
- 1,489 stitches;
- 2,655 compiled choices;
- 44 world events;
- 14 ecology zones;
- 479 ecology species;
- 1,062 tests passed / 0 failed.

The production-review choice count and compiler choice count are different metrics; both are retained intentionally.

---

# 2. LIBRARY V2

The reusable structural vocabulary remains:

**R01→R38**

M03, M04, M05, M06 and the complete runtime implementation of M07 were audited and did not prove a missing reusable topology that justifies R39+.

This is intentional. New story content is expected to reuse or compose existing structures.

---

# 2A. M06–M07 RUNTIME EXTENSION EVIDENCE

M06 — *Oltre i Confini* is runtime-validated at **220 logical nodes / 484 meaningful choices**.

M07 — *Sotto i Riflettori* is runtime-validated at **210 logical nodes / 462 meaningful choices**.

Combined evidence:

- M6 and M7 both preserve exact logical production budgets;
- M7 contains all 14 required blocks M7_00→M7_13;
- all **210/210 M7 nodes** are reachable from the real module entry;
- no zero-incoming padding islands or broken M7-local targets remain;
- World Qualifier and Last Chance use real E5 official-match handoffs;
- Rank S remains distinct from `world_qualified`;
- the Last Chance route is finite and cannot loop until victory;
- FRIEND_BEAT_07 and Before the Lights respect real NPC schedule/location state;
- the final exit contract unlocks **M8 only for world-qualified runs** and **M12 only for Worlds Missed**;
- complete M7 Library V2 declarations use R01→R38 only; no R39 candidate is justified;
- Bookgame Tests run `37451515216` on content commit `4fc8541d10d24774b92cd78718d643c2d756da6b`: **1,158 passed / 0 failed**.

M06 and M07 therefore extend the runtime-validated Library V2 corpus through the Rank S / World Qualifier phase.


---

# 3. M05→M12 SPEED RULE

For every new block:

1. identify the block's engine/gameplay job;
2. map it to R01→R38 before writing scene topology;
3. REUSE the pattern when possible;
4. ADAPT parameters/state/content when necessary;
5. compose several Rxx for complex blocks;
6. keep only the story-specific layer UNIQUE;
7. create a new Rxx candidate only when R01→R38 are structurally insufficient.

The default assumption is:

**EXISTING PATTERN FIRST.**

---

# 4. REQUIRED BLOCK DECLARATION

Every M05→M12 production block must document:

```
Reuse class: REUSE | ADAPT | UNIQUE
Source archetypes:
- Rxx_NAME
Unique layer:
- ...
```

A completed M05→M12 block without a reuse declaration is incomplete from a production-process perspective.

---

# 5. NEW Rxx PROMOTION GATE

A new archetype may be promoted only if all are true:

- existing R01→R38 cannot express the topology cleanly;
- the behavior is implemented;
- automated tests pass;
- save/reload and idempotence are covered where relevant;
- it is generic rather than module-story-specific;
- plausible reuse exists outside its first scene/module.

Otherwise keep the work as an adaptation/composition of existing Rxx.

---

# 6. DO NOT REBUILD ENGINE SYSTEMS

M05→M12 must continue reusing the existing engines for:

- E1 Conditions;
- E2 Time / Calendar;
- E3 Quest State;
- E4 NPC / Relationships;
- E5 Competition;
- E6 Living World;
- E7 Ecology;
- Pokémon 5e combat/rules state.

A content gap is not permission to create a module-local substitute.

---

# 7. STRUCTURAL BUDGET

Campaign planning remains approximately:

- 2,400–2,600 logical nodes;
- ~5,000–6,000 meaningful choices.

Targets are elastic.

Do not pad modules to hit node counts.

The library-first rule should reduce authoring time, not reduce player agency or meaningful branch density.

---

# 8. AUTHORING ORDER FOR EACH MODULE

For M05→M12:

```
MODULE DESIGN
→ BLOCK JOBS
→ Rxx ROUTING
→ LOCAL STATE/CANON DATA
→ SCENE AUTHORING
→ TESTS
→ COMPILER
→ CROSS-MODULE REGRESSION
→ REUSE AUDIT
→ COMPLETE
```

This order is now canonical for production.

---

# 9. LOCK

**NODE LIBRARY V2 is the mandatory structural baseline for M05→M12.**

Current lock:

**R01→R38 / 1,564 runtime-validated logical nodes and 3,579 meaningful choices across M01→M07, with no R39 requirement.**
