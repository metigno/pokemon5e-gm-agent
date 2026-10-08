# FASE 3 — M01–M12 avversari, livelli Pokémon e fauna

**Autorità:** [P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md](P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md)  
**Progressione giocatore:** [pokemon-xp-balance.mjs](../src/engine/pokemon-xp-balance.mjs)  
**Bilanciamento dei combattimenti:** [encounter-level-balance.mjs](../src/engine/encounter-level-balance.mjs)

## Metodo e ambito

Il controllo agisce sui **file giocabili** `bookgame/content/scenes/*.json`, non sui testi di riferimento. Il test `encounter-level-balance.test.mjs` controlla tutti gli handoff `choices[].combat` dei moduli M01–M12. Non modifica ID di nodi, scelte, `goto`, `conditions`, `effects`, `timeCostMinutes`, esiti o mortalità.

- I livelli **Trainer** degli NPC sono indipendenti dal livello dei Pokémon. Gli NPC persistenti espongono il proprio `trainerLevel` quando esiste; `null` indica che il livello Trainer non è stato stabilito, non che sia uguale a quello del Pokémon. I livelli dei Five sono autorità della FASE 2 e non vengono sovrascritti.
- Un avversario **STANDARD/HARD**, un incontro selvatico o una prova non Élite non supera il cap Pokémon del modulo.
- Uno scontro **ELITE** può avere al massimo **+1 livello** rispetto al cap del giocatore, come vantaggio *fisso e documentato*, mai dipendente dal roster del giocatore.
- La difficoltà continua a derivare anche da squadra, mosse, combinazioni e numero di Pokémon; non sono aggiunti scaling nascosti o normalizzazione al Lv20 prima del Mondiale.
- Il Mondiale M09–M11 recupera le formazioni canoniche persistenti dal resolver della FASE 4: niente squadre proxy e nessuna modifica delle specie o dei roster. Le quest leggendarie restano come approvate nella FASE 4.

## Bande di livello

| Modulo | Cap Pokémon giocatore | Avversari non Élite | Élite (massimo) | Fauna dinamica della zona |
| --- | ---: | ---: | ---: | --- |
| M01 | 5 | 5 | 6 | 1–4 |
| M02 | 6 | 6 | 7 | 2–5 |
| M03 | 8 | 8 | 9 | 4–7 |
| M04 | 10 | 10 | 11 | 7–9 |
| M05 | 12 | 12 | 13 | 9–11 |
| M06 | 14 | 14 | 15 | Nessun pool dinamico M06 |
| M07 | 16 | 16 | 17 | Nessun pool dinamico M07 |
| M08 | 18 | 18 | 19 | Nessun pool dinamico M08 |
| M09–M12 | 20 | 20 | 20 | Nessun pool dinamico M09–M12 |

La banda di fauna è collegata al profilo di **zona/modulo**, non al livello attuale del party; rientrare a Ginestre in endgame non aumenta artificialmente gli animali. Il compilatore elimina dalle normali tabelle ecologiche le specie il cui `minLevel` Pokémon 5e supera il massimo locale, evitando catture fuori cap. Le specie ordinarie rimangono legalmente catturabili.

La selezione già esistente del pool ecologico restituisce anche un livello determinato dallo stesso ticket randomizzato (non aggiunge un tiro né altera la selezione della specie). Il motore trasferisce quel livello **una volta** al corrispondente combattimento selvatico nella scena raggiunta; non può contaminarne uno successivo.

## Correzioni sugli avversari statici

| Combattimento o categoria | Prima | Dopo | Motivo |
| --- | --- | --- | --- |
| Primo incontro ufficiale M01 | Lv2 | Lv4 | Primo match competitivo non banale contro starter Lv5 |
| Rookie Invitational M02 | Lv4 | Lv5 | Migliore progressione verso la prova |
| Trial E→D M02 | 5/5/4 | 6/6/5 | Prova HARD coerente con cap Lv6 |
| Masters Entry M05 | Lv14 | Lv13 | Élite +1, non +2 |
| Masters Circuit M06 | Lv15 | Lv14 | Sfida entro cap di M06 |
| Continental Cup M06 | Lv16 | Lv15 | Élite +1, non +2 |
| Trial A→S M06 | Lv17 | Lv15 | Élite +1, non +3 |
| Qualifier R1 M07 | Lv18 | Lv16 | Primo turno accessibile, senza scaling |
| Qualifier Final M07 | Lv19 | Lv17 | Élite +1 |
| Last Chance Final M07 | Lv19 | Lv17 | Élite +1 |
| Bracconiere M02 | specie `trainer`, Lv4, catturabile | **Rattata Lv5** appartenente al Trainer `PoacherCampo01`, registrato | Un Trainer non è una specie Pokémon e il suo Pokémon non è una cattura selvatica |

Rimane invariata la struttura dei roster, delle prove, del ranking, dei branch di vittoria/sconfitta e delle conseguenze di morte. I combattimenti opzionali di M01–M05 che erano già sotto cap vengono preservati. Nessuna cattura o grind facoltativo può superare il cap di XP della FASE 1.

## Gate di regressione

`npm --prefix bookgame run validate:story` e `npm --prefix bookgame test` verificano:

1. tutti i combattimenti statici dei file reali e le bande dei moduli;
2. le prove principali e le qualificazioni;
3. la separazione livello Trainer / livello Pokémon nel combattimento;
4. i minimi Pokémon 5e e i limiti ecologici indipendenti dal giocatore;
5. il passaggio livello ecologico → combattimento e l'impossibilità di riutilizzare un vecchio avvistamento;
6. il mantenimento degli avversari dinamici canonici M09–M11.

**Nota sulla calibrazione:** il limite Élite +1 è una regola di bilanciamento conservativa per la FASE 3. Non sostituisce eventuali playtest end-to-end di difficoltà tattica, né interviene sulle milestone NPC/World già completate.
