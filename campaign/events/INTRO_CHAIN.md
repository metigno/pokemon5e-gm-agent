# INTRO CHAIN — THE FIVE

Chain ID: `INTRO_FIVE`

This intro is structurally identical for Luke, Mattew, Daniel, Edward and Fab.

Only viewpoint and player-controlled behavior change.

The selected protagonist is NEVER given scripted dialogue or forced emotion.

## Fixed opening location

**Interregional Trainer Licensing Center — Starting Campus**

The wider region can be established naturally during campaign setup/play. The campus is shared by all five.

## INTRO_00 — Before the Doors Open

**Type:** HARD_ANCHOR  
**Trigger:** protagonist selected  
**Checkpoint:** CP-PRE-INTRO

Morning.

The five friends wait together outside the licensing center.

Establish:
- they already know one another well;
- today they may begin independent trainer travel;
- all are Trainer Level 1;
- none of their later careers has happened.

Staff call the five names together.

The player may talk, inspect, wander around the campus entrance or delay.

The ceremony still occurs that morning unless the player deliberately abandons registration.

If the player refuses registration, the other four continue. The player's legal trainer career remains blocked until they return or find another valid route.

## INTRO_01 — License Hall

**Type:** HARD_ANCHOR

Verify the five applications.

For the selected player, resolve any remaining Trainer Level 1 Pokémon 5e choices before the first official battle, including initial specialization.

Issue the active Pokémon 5e Trainer starting package:
- Trainer's License;
- Pokédex;
- 5 Poké Balls;
- 1 Potion;
- starter;
- active Pokémon 5e starting-money roll.

NPC friends receive equivalent legal packages and private money state.

A hall display shows the international competitive circuit and World Championship.

It promises nothing. It only shows that the path exists.

## INTRO_02 — Five Poké Balls

**Type:** HARD_ANCHOR  
**Checkpoint:** CP-CHAIN-INTRO-STARTERS

Fixed assignments:

- Luke → **Hisuian Growlithe Lv. 5**
- Mattew → **Eevee Lv. 5**
- Daniel → **Gastly Lv. 5**
- Edward → **Totodile Lv. 5**
- Fab → **Koffing Lv. 5**

These are persistent individual Pokémon.

### NPC reaction seeds

Use only if that friend is NOT the selected player.

**Luke:** his restless energy drops for a moment; he gets to Growlithe's height and allows the Pokémon to choose whether to approach first.

**Mattew:** watches Eevee's posture, ears and distance before touching it, trying to understand its reactions.

**Daniel:** studies Gastly's movement and timing with immediate fascination.

**Edward:** reacts openly and wants to discover what Totodile can do as soon as possible.

**Fab:** gives Koffing space and time, speaking softly rather than controlling the first interaction.

If one of these is the player, narrate only the starter and ask what the player does.

## INTRO_03 — First Contact

**Type:** SOFT_ANCHOR inside the mandatory intro

Each trainer gets time with the starter.

The player may talk, observe, feed it, test a harmless command or make a relevant Pokémon 5e check.

Do not require a roll for ordinary kindness that should simply work.

A failed check creates personality, misunderstanding, nerves or a small complication; it does not make the starter arbitrarily reject the trainer.

Create initial bond/personality state here.

## INTRO_04 — Field Certification

**Type:** HARD_ANCHOR

The five complete a supervised field exercise before licenses become fully active.

It contains three fixed beats with free solutions:

1. **Navigation/observation** — a simple environmental problem.
2. **Unexpected wild complication** — choose a canonical wild Pokémon from the actual starting area's legal encounter context once that area is established. The Pokémon has a goal and is not automatically hostile.
3. **Team decision** — help, avoid, calm, distract, legally attempt a capture, or another plausible solution.

The player chooses freely.

The four NPC friends follow their rookie personalities.

No capture is required to pass.

## INTRO_05 — First Official Battle

**Type:** COMPETITIVE_GATE  
**Checkpoint:** CP-PRE-FIRST-BATTLE / CP-POST-FIRST-BATTLE

A supervised one-Pokémon match is required to activate the competitive portion of the license.

The player chooses one of the four NPC friends as opponent.

The remaining friends are paired separately and resolved honestly off-screen.

Rules:
- Pokémon 5e combat;
- starter only;
- Pokémon Lv. 5;
- no predetermined winner;
- losing does not end the campaign;
- safety/injury/death follows the active rules and supervised context.

The instructor evaluates legal command and safety, not only victory.

Update relationship flags after the battle.

## INTRO_06 — The Gate Opens

**Type:** HARD_ANCHOR  
**Checkpoint:** CP-POST-INTRO

Licenses activate for trainers who completed certification.

The five stand together for the last guaranteed time before free-roam.

They may stay together, split, choose different routes, cooperate or challenge each other later.

Do not force a farewell speech from the player.

The other four begin independent NPC schedules as soon as the scene ends.

Set:
- `intro_complete = true`
- `world_day = 1`
- `free_roam = true`

Then describe the real surrounding world and ask what the player does.

No main quest is automatically accepted.
