# P5E LIBROGAME — NODE LIBRARY V2 LOCK

**Status:** LOCKED BASELINE FOR M05→M12 AUTHORING  
**Production branch reviewed:** `m5-00-04-work`  
**Validated corpus:** M01 + M02 + M03 + M04 + M05  
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
| **TOTAL** | **1,134** | **2,633** |

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

M03, M04 and M05 were audited after implementation and did not prove a missing reusable topology that justifies R39+.

This is intentional. New story content is expected to reuse or compose existing structures.

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

**R01→R38 / 1,134 validated logical nodes of empirical evidence / five complete modules.**
