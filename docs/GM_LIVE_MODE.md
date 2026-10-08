# GM Live — modalità campagna libera

Branch derivato da `bookgame-canonical`. Non sostituisce il librogame canonico.

## Contratto
- Master conversazionale: il giocatore può dichiarare qualsiasi azione plausibile, senza menu di scelte obbligatorio.
- Regole Pokémon 5e e stato canonico come base; scene M01–M12 sono riferimenti del mondo, non binari obbligatori.
- Esiti non predeterminati: dadi verificabili, successi, fallimenti, conseguenze, morte e progressione.
- NPC Five e altri personaggi mantengono personalità, obiettivi, conoscenze e continuità.
- Il Master non rivela informazioni segrete e non impone esiti narrativi.
- Uno slot esclusivo `gm-live-slot-1`, con snapshot versionati, autosave atomico e caricamento; non sovrascrivere i tre slot del bookgame.
- Ogni azione modifica uno stato strutturato (personaggio, squadra, inventario, tempo, luogo, flag, NPC, quest, log e seed dei dadi).
- L'interfaccia mobile deve collegare chat e runtime mediante API autenticata; una semplice URL a ChatGPT non sincronizza automaticamente lo slot.
- Gli asset offline già esistenti sono riutilizzati dove disponibili, senza inventare copertura o stato di build.

## Acceptance test
1. Nuova campagna, salva, chiudi, riapri e riprendi dal medesimo stato.
2. Azione fuori copione con conseguenza persistente.
3. Combattimento con dadi e modificatori tracciabili.
4. Cinque protagonisti selezionabili e NPC coerenti.
5. Slot GM isolato dai salvataggi canonici.
6. Nessuna regressione del ramo canonical.

## Stato
Documento di progetto iniziale. ChatGPT non è ancora collegato al runtime né a un endpoint di salvataggio; nessuna build o deployment è implicata dalla creazione del ramo.
