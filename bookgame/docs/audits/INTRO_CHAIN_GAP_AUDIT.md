# Audit — INTRO_FIVE versus runtime intro-m01

Status: OPEN / BLOCKING. Branch: `bookgame-intro-chain-restoration-v1`.

## Authority
- `campaign/events/INTRO_CHAIN.md` is the canonical event chain (INTRO_00 through INTRO_06).
- `bookgame/docs/P5E_NARRATIVE_REFERENCE_MASTER_V1.md` governs voice, player agency, and characterization.
- `bookgame/docs/00_SOURCE_OF_TRUTH.md` governs state and engine separation.

## Verified gaps in current canonical runtime
1. `bookgame/content/scenes/intro-m01.json` starts at `trainer_specialization`; the scene has only specialization, tutorial, release. INTRO_00–INTRO_06 are not implemented there.
2. `bookgame/src/engine/state.mjs` constructs a fresh `startAtIntro:true` save with starter already in roster and license, Pokédex, five Poké Balls and Potion already in inventory; it also starts at `intro-m01#trainer_specialization`. This is inconsistent with player-visible staged award at INTRO_01–02.
3. `bookgame/tests/intro-m01-canonical.test.mjs` explicitly asserts the premature specialization node. It must be replaced with an end-to-end chain test, not merely adjusted to a new first node.
4. The existing `tutorial_choice` and `tutorial_rules` may be reused, but cannot replace field certification or supervised first battle.

## Required implementation gates
- INTRO_00: five friends waiting at Asteria campus; selectable actions and no scripted dialogue/emotion for player.
- INTRO_01: registration, trainer specialization and actual state-based award of license, Pokédex, five Poké Balls, Potion and starting-money roll; never duplicate awards on resume.
- INTRO_02: starter handover (Luke Hisuian Growlithe, Mattew Eevee, Daniel Gastly, Edward Totodile, Fab Koffing), persistent and once-only.
- INTRO_03: first contact, observable behavior and player choice.
- INTRO_04: supervised navigation/ecology/team field exercise with meaningful noncombat routes.
- INTRO_05: selectable friend opponent, actual Pokémon 5e battle and win/loss continuation.
- INTRO_06: activate license and free roam only after certification and match; no forced player speech.

## Acceptance tests
1. Fresh saves for all five protagonists begin at INTRO_00 without active license or starter ownership.
2. Awards occur exactly once at the relevant narrative beat, including after save/load and repeated requests.
3. INTRO_04 has valid noncombat choices; INTRO_05 runs real battle and supports loss as well as win.
4. No skip to free roam before completion; all flags, inventory and roster survive reload.
5. All five routes retain their distinct starter and NPC characterization; existing M01 and later scene regressions remain green.

Do not mark this audit PASS until the playable chain and tests are implemented. Do not merge this audit alone as a narrative fix.
