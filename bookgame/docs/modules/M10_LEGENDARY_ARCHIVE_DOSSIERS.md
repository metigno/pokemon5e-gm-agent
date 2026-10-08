# M10 — Legendary archive dossiers (optional R16 preparation)

Authority: `bookgame/docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md` and `bookgame/docs/LEGENDARY_QUEST_LEVEL_GUARDRAILS.md`.

During `m10-r16-prep#callbacks`, the existing `callbacks_readiness` choice now optionally cross-checks the trainer's collected dossier. Its destination remains `readiness`; no extra logical nodes or choices are added (12 nodes, 27 choices).

If and only if the **matching trainer** previously advanced the personal lead in M09, completed the M10 Silas thread, entered an opened official R16 bracket, remained World-qualified since M07, and deliberately reviewed the archive, `legendary-m10-archive-dossiers.json` resolves the old active `legendary_m08_lead_*` with `archive_crosschecked`, offers `legendary_m10_dossier_*`, and sets a personal `legendary_m10_dossier_*` flag.

| Trainer | Investigation, not reward |
|---|---|
| Luke | Reconcile Kyurem, Zekrom and conflicting accounts of the original dragon; Black Kyurem is not acquired |
| Mattew | Investigate Zacian's oath and the Rusted Sword, still unrecovered |
| Daniel | Cross-check Mewtwo origin testimonies and safeguard its autonomy |
| Edward | Compare sea routes and storm reports; Lugia's presence remains unverified |
| Fab | Investigate Rayquaza atmospheric evidence; no Mega form is granted |

World competition, Pokémon stats/levels, roster, gear, items and locations are untouched. There are no encounters or guaranteed captures. The stage is intentionally optional; an M09-eliminated player does not reach R16 prep, but an existing Legendary lead is **not failed or erased** and can remain pending for any future explicitly authored continuation.

The dossiers provide quest-log objectives, not yet branching investigations or legendary encounters. Encounter levels must be defined from the authoritative Pokémon-level cap before any future battle is authored.
