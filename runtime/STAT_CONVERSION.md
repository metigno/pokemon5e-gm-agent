# Motor stats → Pokémon 5e conversion

The motor's eight Player Stats already use a 1–20 scale and the d20 modifier formula:

`modifier = floor((score - 10) / 2)`

Therefore their primary conversion is lossless.

## Direct tactical checks

| Motor stat | Meaning in play |
|---|---|
| Tattica | immediate battlefield choice, positioning, tempo |
| Strategia | multi-turn planning and win conditions |
| Prediction | reading likely enemy actions |
| Mind Games | feints, deception, pressure, bluffing |
| Conoscenza | Pokémon/move/ability/rules knowledge |
| Adattamento | updating the plan after new information |
| Gestione Team | coordinating roster and commands |
| Gestione Rischio | balancing upside, survival and uncertainty |

When the GM calls for a motor tactical check:

`d20 + motor modifier`

Only add proficiency when a real feature/proficiency justifies it.

Do not add these bonuses to Pokémon attack, damage, AC, saves or captures unless Pokémon 5e explicitly says so.

## Missing NPC ability projection

Use only if the NPC has no established 5e scores.

```
INT = round(0.45*Strategia + 0.40*Conoscenza + 0.15*Tattica)

WIS = round(
  0.30*Prediction +
  0.25*Adattamento +
  0.25*GestioneRischio +
  0.20*Tattica
)

CHA = round(
  0.45*GestioneTeam +
  0.35*MindGames +
  0.20*Adattamento
)

DEX = clamp(
  8, 16,
  round(10 + 0.35*(Tattica-10) + 0.15*(Prediction-10))
)
```

STR and CON come from the physical concept/template. Default to neutral 10 only when absent.

Existing scores always win.

## Composite tactical skills

- Battle Tactics = mean(Tattica, Strategia)
- Read Opponent = mean(Prediction, Mind Games)
- Pokémon Knowledge = mean(Conoscenza, Strategia)
- Adapt Under Pressure = mean(Adattamento, Gestione Rischio)
- Command Team = mean(Gestione Team, Tattica)
- Risk Assessment = mean(Gestione Rischio, Prediction, Strategia)

Prefer standard 5e skills such as Insight, Investigation, Nature, Perception, Persuasion, Survival or Animal Handling when one clearly covers the action.

## Behavior Profile

The motor's 0–1 Behavior Profile is NOT converted to dice:
aggression, switching, setupAppetite, controlPreference, sustainPreference, sacrificeTolerance, preservation, riskAppetite, tempo.

These change preferences, not competence.
