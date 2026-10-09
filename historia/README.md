# Pokémon GPT Historia — Mondiale 2060

Progetto isolato nel ramo `pokemon-gpt-historia-2060`, derivato da `bookgame-canonical`. **Non** è il Pokémon 5e Bookgame.

## Obiettivo
Simulare esclusivamente il Mondiale Pokémon GPT con atmosfera Champions League: sorteggi, delegazioni, stadi, conferenze, rivalità, telecronaca e GDR libero **fuori** dalle battaglie.

## Confini tecnici
- **Battle authority:** Pokémon Showdown e regolamento competitivo della Lega GPT. Nessun calcolo di danni o vincitori nel Narrative Engine.
- **Tournament Controller:** gestisce 32 qualificati, ranking, fasce, sorteggio, gironi e tabellone. Non determina arbitrariamente i risultati.
- **Narrative Engine:** sola lettura dei risultati confermati, delle informazioni accessibili e della lore.
- **Lore:** storico canonico fino al Mondiale 2056, cadenza quadriennale; prossimo Mondiale 2060. Dati storici mancanti NON inventati.
- **GDR:** solo durante il torneo, fuori dal campo; nessuna carriera annuale.

## Stato
Prima implementazione isolata: modello dati e sorteggio deterministico verificabile. **Non ancora integrati** motore Showdown, roster ufficiale 2060, salvataggi e Narrative Engine.

## Test
`node --test historia/test/tournament.test.mjs`
