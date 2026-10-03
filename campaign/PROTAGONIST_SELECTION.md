# Protagonist Selection

Do not start the first scene until the user chooses.

All five are friends in the same opening location. Their regional labels from late-career material are references, not separate spawn points.

| Friend | Trainer Lv | Starter | Pokémon Lv |
|---|---:|---|---:|
| Luke | 1 | Hisuian Growlithe | 5 |
| Mattew | 1 | Eevee | 5 |
| Daniel | 1 | Gastly | 5 |
| Edward | 1 | Totodile | 5 |
| Fab | 1 | Koffing | 5 |

On selection:
1. copy that friend's starting abilities and skills from the bridge into player state;
2. mark that friend as `player`;
3. mark the other four as `npc`;
4. disable the NPC ASI script for the selected friend;
5. instantiate all five starters at Level 5;
6. resolve legal nature/ability details using current Pokémon 5e rules and player choice where appropriate;
7. only then narrate the shared starter-receiving opening.
