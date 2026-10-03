# LEGA GPT Player Stats → classic D&D / Pokémon 5e

The old eight Player Stats are no longer rolled in-game.

They are migration inputs used once to produce the six classic abilities:

`STR / DEX / CON / INT / WIS / CHA`

All future checks use normal D&D/Pokémon 5e ability checks, saving throws and skill proficiencies.

## Conversion

For a legacy profile:

```
DEX = round(
  0.50*Tattica +
  0.30*Adattamento +
  0.20*Prediction
)

INT = round(
  0.30*Strategia +
  0.30*MindGames +
  0.25*Conoscenza +
  0.15*Tattica
)

WIS = round(
  0.40*Prediction +
  0.30*Adattamento +
  0.30*GestioneRischio
)

CHA = round(
  0.60*GestioneTeam +
  0.20*Tattica +
  0.20*Adattamento
)
```

Scores are clamped to 1–20.

STR and CON describe physical ability and are not meaningfully encoded by the eight tactical stats. Baseline human trainer values are 10/10 unless a canon physical background supplies different values.

## Canon converted profiles

| Trainer | STR | DEX | CON | INT | WIS | CHA |
|---|---:|---:|---:|---:|---:|---:|
| Luke | 10 | 18 | 10 | 16 | 17 | 17 |
| Mattew | 10 | 20 | 10 | 20 | 20 | 20 |
| Daniel | 10 | 20 | 10 | 20 | 20 | 20 |
| Edward | 10 | 18 | 10 | 15 | 18 | 17 |
| Fab | 10 | 19 | 10 | 18 | 19 | 19 |

These replace the old parallel Player Stats for tabletop resolution.

## Preserve the old purpose using real 5e checks

| Old purpose | Pokémon 5e / D&D resolution |
|---|---|
| Tattica — personal positioning | DEX (Acrobatics) |
| Tattica — Pokémon command timing | CHA (Animal Handling) |
| Strategia | INT (Investigation) |
| Prediction | WIS (Insight), sometimes WIS (Perception) |
| Mind Games | INT (Investigation); INT (Intimidation/Performance) when the proficiency fits |
| Conoscenza | INT (Nature), sometimes INT (Investigation) |
| Adattamento | WIS (Survival) or WIS (Insight) |
| Gestione Team | CHA (Animal Handling) or CHA (Persuasion) |
| Gestione Rischio | WIS (Insight) or WIS (Perception) |

The GM chooses the ability + proficiency based on what the trainer actually attempts.

Example:
A trainer fakes a switch pattern to make the opponent commit to the wrong plan. This is no longer “roll Mind Games”. It can be **INT (Investigation)** to construct/read the tactical deception, or **INT (Performance)** if Performance proficiency is the relevant established expertise.

## Pokémon 5e authority

The converted ability scores interact with Pokémon 5e normally. They do not create hidden bonuses on Pokémon attacks, damage, AC or capture checks.

Trainer class core:
- Primary Ability: CHA.
- 2024 Hit Die: d6.
- Level 1 HP: 6 + CON.
- Saving Throw proficiency: CHA.
- Animal Handling proficiency plus two Trainer skill choices.
