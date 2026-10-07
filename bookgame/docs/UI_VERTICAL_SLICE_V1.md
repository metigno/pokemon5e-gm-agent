# UI Vertical Slice V1

Prima UI grafica reale del Pokémon 5e Digital Bookgame.

## Scopo

Questo slice applica il Master UI/UX e il Visual Design System alla storia M1 reale senza duplicare le regole nel browser.

La UI usa direttamente:

- `BookgameEngine` per scene, condizioni, tempo, check ed effetti;
- `SaveStore` per persistenza locale;
- `Pokemon5eCombatEngine` per il combattimento;
- i contenuti M1 già presenti in `bookgame/content/scenes/`.

## Avvio

Da `bookgame/`:

```bash
npm run ui
```

Poi aprire:

```text
http://127.0.0.1:4173
```

Non serve connessione internet e non sono richieste dipendenze runtime esterne.

## Regola narrativa LOCKED

Dopo una scelta il testo del nodo successivo viene rivelato progressivamente.

Default:

- Normale: 32 ms/carattere;
- pause aggiuntive sulla punteggiatura;
- tap/click sul testo o “Mostra tutto” completa immediatamente il blocco;
- le scelte successive restano nascoste fino a fine reveal;
- Lenta / Normale / Veloce / Istantanea in Impostazioni;
- `prefers-reduced-motion` forza la modalità istantanea.

## Superfici incluse

- Story Screen M1 reale;
- Trainer drawer;
- Team drawer;
- Inventory drawer;
- Journal drawer;
- Settings;
- new game / continue;
- salvataggio automatico dopo scelte e azioni;
- battle screen collegata al resolver Pokémon 5e;
- mosse legali esposte dal combat engine;
- fine turno;
- forced switch quando applicabile;
- ritorno automatico alla narrativa quando il resolver produce un outcome.

## Confine V1

Questo slice non introduce ancora asset illustrati finali: la scena usa un placeholder grafico locale in CSS. La struttura è pronta per associare asset ambientali/NPC ai metadati delle scene senza cambiare le regole del runtime.

Il battle screen V1 espone il core necessario per il percorso M1; controlli spaziali avanzati, target manuale delle aree e inventario da battaglia esteso restano evoluzioni successive.
