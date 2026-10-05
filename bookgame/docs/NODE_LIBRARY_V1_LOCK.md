# P5E LIBROGAME — NODE LIBRARY V1 LOCK

**Status:** LOCKED BASELINE FOR M03 AUTHORING  
**Canonical campaign state reviewed:** `pokemon5e-digital-bookgame@770acec`  
**Library branch:** `m1-reuse-base`

---

# 1. COMPLETE MODULE BASELINE

## M01
- 202 runtime nodes
- 463 choices

## M02
- 189 runtime nodes
- 409 choices

## Combined
- **391 runtime nodes**
- **872 choices**
- **~2.23 choices per node**

The combined M01+M02 corpus is the empirical basis for Node Library V1.

---

# 2. LIBRARY V1

The reusable catalog currently contains:

- **R01→R38 proven reusable archetypes**

M01 produced R01→R32.
M02 promoted:
- R33 Cross-Module Callback
- R34 Access Boundary / Reconnaissance Gate
- R35 Conditional Ally Co-Action
- R36 Multi-Modal Conflict Resolution Lattice
- R37 Multi-Round Tournament Lifecycle
- R38 Composite Outcome Classifier

---

# 3. GLOBAL STRUCTURAL BUDGET

Current planning target for the complete 12-module campaign:

- **~2,500 runtime nodes**
- **~5,500 meaningful choices**
- acceptable planning band:
  - nodes: **2,400–2,600**
  - choices: **~5,000–6,000**

This is a structural production target, not a quota to pad.

The old `60,000 stitches / 35,000 choices` envelope must not be interpreted as 60,000 runtime nodes. Narrative micro-content/stitches are a separate editorial metric.

---

# 4. MODULE PLANNING REFERENCE

| Module | Node target | Choice planning target |
|---|---:|---:|
| M01 | 202 actual | 463 actual |
| M02 | ~220 planning / **189 actual** | ~484 planning / **409 actual** |
| M03 | ~260 | ~572 |
| M04 | ~250 | ~550 |
| M05 | ~240 | ~528 |
| M06 | ~220 | ~484 |
| M07 | ~210 | ~462 |
| M08 | ~190 | ~418 |
| M09 | ~170 | ~374 |
| M10 | ~160 | ~352 |
| M11 | ~150 | ~330 |
| M12 | ~228 | ~502 |

Targets are elastic. A module may finish below or above its planning figure when its graph is complete and meaningful.

Do not add filler nodes solely to hit the target.

---

# 5. M03+ AUTHORING RULE

For each new production block:

1. define the block's narrative/gameplay job;
2. attempt to compose it from R01→R38;
3. ADAPT parameters/state/content where needed;
4. create a new structural candidate only if R01→R38 are insufficient;
5. implement and test the candidate;
6. promote it to a new Rxx only after runtime proof;
7. record actual node/choice counts after the block is complete.

The expected long-term behavior is that new Rxx creation declines as the campaign advances.

---

# 6. LIBRARY PRINCIPLE

```
NEW STORY CONTENT != NEW NODE SYSTEM
```

New areas, NPCs, species, conflicts and dialogue should normally reuse proven structural archetypes.

A new Rxx exists only when the engine/content graph needs a genuinely new reusable topology.
