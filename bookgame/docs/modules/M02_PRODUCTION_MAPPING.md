# P5E LIBROGAME — M02 FINAL PRODUCTION MAPPING

**Module:** M02 — Sotto la Nebbia  
**Status:** FINAL REPAIR / PRODUCTION COMPLETE  
**Canonical base:** `8d5d40d175ebf1d0a1e0421c39a3b03786496a34`  
**Counting rule:** count only logical nodes and player choices physically owned by the 15 M02 scene JSON files. Do **not** count M03, tests, documentation, events, engine records, fixtures, stitches, or module metadata.

## 1. Final budget

| Block | Owned scene | Nodes | Choices | Cumulative |
|---|---|---:|---:|---:|
| M2_00 | `m02-rank-e-handoff` | 2 | 3 | 2 / 3 |
| M2_01 | `m02-mistwood-entry` | 8 | 14 | 10 / 17 |
| M2_02 | `m02-capture-signs` | 18 | 41 | 28 / 58 |
| M2_03 | `m02-borgo-salice` | 14 | 41 | 42 / 99 |
| M2_04 | `m02-n-enters` | 23 | 46 | 65 / 145 |
| M2_05 | `m02-ranger-thread` | 10 | 20 | 75 / 165 |
| M2_06 | `m02-marsh-approach` | 10 | 15 | 85 / 180 |
| M2_07 | `m02-poaching-network` | 18 | 38 | 103 / 218 |
| M2_08 | `m02-friend-beat-02` | 25 | 44 | 128 / 262 |
| M2_09 | `m02-rookie-invitational` | 16 | 28 | 144 / 290 |
| M2_10 | `m02-crisis-moves` | 11 | 26 | 155 / 316 |
| M2_11 | `m02-network-outcome` | 15 | 39 | 170 / 355 |
| M2_12 | `m02-trial-registration` | 19 | 60 | 189 / 415 |
| M2_13 | `m02-promotion-trial-e-d` | 17 | 26 | 206 / 441 |
| M2_14 | `m02-trial-result` | 14 | 43 | **220 / 484** |
| **TOTAL M02** |  | **220** | **484** | **220 / 484** |

Final variance from the soft production target is **0 nodes / 0 choices**. This is not a padded exact match: the repair added the missing density only to real stateful work — Official Three review/locking, Trial verification/information/preparation, and win/loss/exit-contract handling.

The pre-repair M02-only baseline was **189 nodes / 409 choices**. The previous 192/413 claim was false because it counted unauthored M03 stub content.

## 2. Block ownership

The production spine is:

```text
M2_00 Rank E Handoff
→ M2_01 Mistwood Entry
→ M2_02 Capture Signs
→ M2_03 Borgo Salice
→ M2_04 N Enters
→ M2_05 Ranger Thread
→ M2_06 Marsh Approach
→ M2_07 Poaching Network
→ M2_08 Friend Beat 02
→ M2_09 Rookie Invitational
→ M2_10 Crisis Moves
→ M2_11 Network Outcome
→ M2_12 Trial Registration
→ M2_13 Promotion Trial E→D
→ M2_14 Trial Result / M2 Exit
```

This is a production order, not a forced linear playthrough. World-state conditions, time, optional competition and retry routes remain authoritative.

## 3. M2_11 — canonical poaching-network outcome

M2_11 is the **only final owner** of `world.flags.poaching_network_state`.

Final values are mutually exclusive because the state is a scalar and the dispatch conditions are mutually exclusive:

- **resolved** — real intervention plus Ranger alert plus full Ranger report.
- **partial** — real but incomplete engagement: investigation/intervention/disruption, Ranger thread/report activity, or crisis evidence, without satisfying resolved.
- **escalated** — no meaningful engagement **and** a real worsening signal such as explicit ignored state or a recorded crisis-escalation type.
- **ignored** — no meaningful engagement and no canonical worsening signal. The engine does not fabricate escalation merely because the player did not act.

`A2_NETWORK_OUTCOME` can become available through actual crisis resolution/time progression and, after a legitimate promotion, at Rank D so a player who left the thread untouched can still receive the canonical `ignored` classification instead of being soft-locked out of M2 completion.

Once `network_outcome_complete=true`, the outcome scene rejects re-entry and the final classification cannot be rewritten by later M02 blocks.

## 4. M2_12 — Official Three is a real engine lock

The E→D Trial registration is not a narrative-only flag.

### Selection/review

The existing roster is the single source of truth. M2_12 does **not** introduce a second roster-selection subsystem.

Before final confirmation the player may:

- inspect Trial format;
- inspect public opponent information;
- review the proposed Official Three;
- reconsider;
- leave and reorder the normal roster;
- return later;
- prepare tactically.

At final confirmation, the **first three Pokémon in the live roster** become the Official Three for that attempt.

### Persistent identity

Registration stores:

`competition.trials.RANK_E_TO_D.registeredPokemonIds`

The engine reuses an existing valid Pokémon `id` when present. If a roster entry has no stable id yet, the engine assigns a persistent `pkm_N` identity instead of inventing a parallel Trial-only identity.

### Battle-start resolution

At Trial start the engine resolves the exact registered identities from the **live** roster.

Therefore:

- A/B/C registered → roster reordered to D/C/B/A → battle still uses A/B/C.
- HP/PP/status/EXP/level are **not snapshotted** by registration; current legitimate live condition is used.
- if a registered identity is missing/unresolvable, Trial entry is rejected with an engine error;
- no Pokémon is silently substituted.

### Loss/retry

A resolved loss clears:

- `registered=false`;
- `registeredAtMinutes=null`;
- `registeredPokemonIds=[]`.

The attempt remains in competition history. Retry requires a new registration, and the player may legally register a different Official Three for the new attempt.

## 5. M2_13 — canonical E→D Promotion Trial

Checkpoint: `RANK_E_TO_D`  
Event: `A2_RANK_TRIAL_E_D`  
Venue: Borgo Salice — Sala Verde / arena  
Trainer band: 4–5  
Format: Singles  
Official roster: 3  
Difficulty: HARD  
Retryable: true  
Points bypass: false  
Win required: true

Opponent is persistent gate staff:

`SAL_GATE_E_D_INES_VARGA`

Fixed authored roster:

- Growlithe Lv5 — Intimidate
- Roselia Lv5 — Natural Cure
- Sableye Lv4 — Keen Eye

There is **no invisible scaling** and no scripted winner.

The expanded pre-battle flow provides meaningful, non-buff decisions:

- official check-in;
- registered-identity verification;
- public roster/profile review;
- neutral-field inspection;
- format review;
- switching/status rule review;
- tactical preparation focus;
- legal withdrawal before start;
- final confirmation.

Preparation focus is context only. It does not alter stats, rolls, HP, initiative or combat rules. The actual result belongs entirely to the Pokémon 5e combat lifecycle.

## 6. M2_14 — result, retry and exit contract

### Loss

After a loss:

- Rank remains E;
- the attempt remains in competition history;
- Trial remains retryable;
- registration is cleared;
- the player must re-register;
- HP/PP/status and all world state remain as actually produced;
- no automatic healing or reset occurs.

The loss flow lets the player inspect the recorded defeat, inspect current roster condition, re-register, return to Sala Verde, or leave Trial progression temporarily.

### Win

A legitimate Trial win changes the real competition state to Rank D.

Rank D structured access includes:

- MIR-MARSH
- RIV-TOWN
- FER-CITY
- VIR-JUNGLE

No duplicate location-access flags are created. Earlier special access remains an authored exception, not retroactive general Rank D access.

### Canonical M2 exit contract

M2 may close only when **all** are true:

1. `competition.rank == "D"`
2. `world.flags.n_met == true`
3. `world.flags.friend_beat_02_complete == true`
4. `world.flags.poaching_network_state` is exactly one of:
   - `resolved`
   - `partial`
   - `ignored`
   - `escalated`

`network_outcome_complete` may remain a callback/history marker, but it cannot replace validation of the canonical outcome enum.

Only the full contract sets:

- `m2_complete=true`
- `m03_unlocked=true`

Completion is idempotent: re-entry does not repeat completion state/rewards.

If Rank D is already earned but a narrative requirement is missing, Rank D persists and M2 remains active. The player can legally return to Borgo Salice and the existing N, Friend Beat 02 or M2_11 routes.

## 7. M3 boundary

M02 does **not** author M3.

The following files must not exist in the repaired M02 branch:

- `bookgame/content/modules/M03.json`
- `bookgame/content/scenes/m03-handoff.json`

M2_14 may set `m03_unlocked=true` after the complete exit contract, but it contains **no cross-scene goto to M3**. The actual handoff will be authored when M3 production begins.

## 8. Regression contract

Final M02 acceptance requires:

- story validator: zero dangling references;
- all M1 regressions green;
- all M2_00–M2_14 regressions green;
- no unexpected skips;
- save/reload preserves registered Official Three identity;
- roster reorder cannot alter registered Trial identities;
- missing registered Pokémon cannot be silently substituted;
- live condition changes are preserved into battle;
- loss clears Trial registration;
- retry may register a new legal trio;
- `resolved/partial/ignored/escalated` each satisfy the exit enum;
- missing/invalid network outcome does not;
- missing N does not;
- missing Friend Beat does not;
- Rank E does not;
- Rank D win persists while incomplete;
- completion cannot be duplicated.

## 9. Production rule

Do not pad M02 further to protect the exact count. Any future change must be justified by route, information, time, risk, preparation, roster state, competition state, relationship, world state or future access. If a real repair changes the count, correctness wins over preserving 220/484.
