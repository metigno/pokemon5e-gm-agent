# Pokémon Historia Web — MVP tecnico

Avvio: `cd historia-web && npm start` (Node 20+), poi aprire http://localhost:3000. Per la chat impostare `OPENAI_API_KEY` come variabile d'ambiente server; opzionale `OPENAI_MODEL`. Non inserire la chiave nel browser o nel repository.

Disponibile: UI mobile chat/arena, scelta modalità per incontro (solo UI), apertura sito Showdown, importazione manuale log, parsing eventi, chat AI opzionale. La cronologia chat è solo in RAM, non persistente.

**Non disponibile:** battaglie Showdown incorporate, controllo Luke via AI, autenticazione, salvataggi persistenti, import replay da URL, sincronizzazione automatica dei risultati, lore completa dal repository e tornei gestiti automaticamente. Non dichiarare il prototipo come gioco completo.

Passi successivi: test automatici, persistenza DB, caricamento canon, motore Showdown self-hosted, controller AI e interfaccia interattiva, test end-to-end. Evitare merge finché CI non è green.

## Protocollo battaglia — avanzamento

`showdown-protocol.mjs` fornisce `legalChoices(request)`, `validateChoice(request,choice)` e `selectAiFallback(request)` per richieste **singles semplici**. Coperti con test: PP esauriti, mosse disabilitate, switch, forceSwitch e wait.

**Limiti importanti:** non è ancora un simulatore, non gestisce scelta dei target/doubles, Mega/Dynamax/Tera, richieste multi-active, trapped, reviving o turni speciali. L'AI fallback non è tattica. Prima di esporre la battaglia al pubblico bisogna integrare e testare `@pkmn/sim` o un server Showdown, con legalità finale verificata dal motore stesso.

## Simulatore reale — adapter iniziale

`showdown-engine.mjs` usa dinamicamente `BattleStream` e `getPlayerStreams` del pacchetto `pokemon-showdown`. Richiede `npm install` e una versione del pacchetto che esponga queste API. Le due squadre vanno fornite nel formato packed di Showdown; il worker restituisce stream per entrambi i lati e spettatore.

**Non è ancora un'integrazione funzionante end-to-end:** non sono stati verificati installazione, export del pacchetto, format ID, ciclo completo dei turni, request handling e compatibilità delle regole custom Historia (Mega + Dynamax). La UI non avvia ancora il worker. Prima di un merge occorrono test di integrazione reali, fix del protocollo e un controller dei turni con gestione degli errori.
