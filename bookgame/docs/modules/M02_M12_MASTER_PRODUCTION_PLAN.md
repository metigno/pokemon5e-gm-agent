# P5E LIBROGAME — M02→M12 MASTER PRODUCTION PLAN

**Branch:** pokemon5e-digital-bookgame  
**Status:** GLOBAL PRODUCTION MAP  
**Baseline:** M01 closed at commit `73d31b90d9e1536157cd6080df98726cfedbda33`

This document fixes the production envelope for the remaining campaign before mass node authoring. It is subordinate to the Engine Source of Truth, the 12 Modules Master, MAIN_EVENT_GRAPH and Rank Checkpoints.

---

# 1. GLOBAL BUDGET

| Module | Title | Levels | Rank/Phase | Stitches | Choices | Status |
|---|---|---:|---|---:|---:|---|
| M01 | Le Prime Strade | 1–3 | F→E | 5,047 | 3,116 | COMPLETE |
| M02 | Sotto la Nebbia | 3–5 | Rank E → D | 5,700 | 3,700 | MAPPED |
| M03 | Ferro, Polvere e Pressione | 5–9 | Rank D → C | 6,000 | 3,900 | MAPPED |
| M04 | Sale, Vento e Marea | 8–12 | Rank C → B | 5,900 | 3,800 | MAPPED |
| M05 | Sopra le Nuvole | 11–15 | Rank B → A | 5,700 | 3,600 | MAPPED |
| M06 | Oltre i Confini | 14–18 | Rank A → S | 5,500 | 3,400 | MAPPED |
| M07 | Sotto i Riflettori | 17–20 | Rank S / World Qualifier | 5,200 | 3,200 | MAPPED |
| M08 | Il Mondo nello Stesso Posto | 18–20 | Pre-World / Draw | 4,400 | 2,500 | MAPPED |
| M09 | Tre Partite per Restare | 18–20 | World Group Stage | 4,300 | 2,300 | MAPPED |
| M10 | Nessuna Seconda Possibilità | 18–20 | Round of 16 + Quarterfinal | 4,000 | 2,000 | MAPPED |
| M11 | Per Diventare Campione | 18–20 | Semifinale + Finale | 3,500 | 1,600 | MAPPED |
| M12 | Dopo il Mondo | 18–20 | WORLD_EXIT / Postgame | 4,753 | 1,884 | MAPPED |
| **TOTAL** |  |  |  | **60,000** | **35,000** | |

Global lock: **60,000 stitches / 35,000 meaningful player choices**.

This is authored capacity, not the length of one playthrough. Branches, optional scenes, missed World stages, ignored quests and postgame variants mean a run sees only a subset.

---

# 2. PROGRESSION SHAPE

The budget is intentionally front/mid-loaded. Early and middle modules establish locations, systems-in-use, relationships and open-world callbacks. Late World modules reuse mature systems and concentrate content around scheduled competition rather than inventing new mechanics.

M8–M12 remain ACT_8/WORLD_EXIT narrative partitions; they do not invent ACT_9.

---

# 3. HARD GLOBAL RULES

- E1–E7 built for M1 are shared infrastructure for all later modules.
- No module-specific clone of conditions, calendar, quests, NPC schedules, competition, living world or ecology.
- Rank ladder remains F→E→D→C→B→A→S.
- World Qualifier is separate from Rank S.
- World results are emergent and actual-bracket-only.
- Anchor/friend plot armor ends once World competition begins.
- FRIEND_BEAT_02→12 is mandatory at story level but never forces an illegal physical encounter or battle.
- No reset at module boundaries.
- No Legendary or endpoint World roster is granted early merely to satisfy narrative plans.
- All combat uses Pokémon 5e state and resolver semantics.

---

# 4. PRODUCTION SEQUENCE

The recommended implementation wave is:

1. **M2–M4:** reuse E1–E7 under different geography/conflict types; prove cross-module continuity.
2. **M5–M7:** high-rank/interregional/Qualifier content and hard competitive gating.
3. **M8–M11:** World field, groups and knockout production from actual state.
4. **M12:** callback-heavy WORLD_EXIT and persistent postgame.
5. Full campaign regression across divergent histories.

A later module can be authored in parallel at document/node level, but cannot be marked production-complete until its upstream state contracts are executable.

---

# 5. DEFINITION OF DONE PER MODULE

A module is COMPLETE only when every mapped block:

- is represented by compiled/validated content;
- uses canonical engine/event state;
- has save/reload and idempotence coverage;
- supports legal win/loss/ignore/skip branches;
- preserves prior module state;
- passes cross-module regression;
- satisfies its exit contract without hidden-force shortcuts.

Mapping completion is not production completion.
