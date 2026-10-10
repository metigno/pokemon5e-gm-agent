# Pokémon Historia Web — integrazione Showdown

## Obiettivo
Un'unica esperienza web/mobile: chat Master AI per i Mondiali Pokémon, arena Showdown interattiva, analisi tecnica del replay e avanzamento persistente. Canon narrativo fino al Mondiale 2056; primo torneo giocabile 2060 e ricorrenza quadriennale.

## Confini
- Branch di sviluppo: `historia-web-showdown-integration`, derivato da `pokemon-gpt-historia-2060`.
- Non modificare `bookgame-canonical`, le regole Pokémon 5e o i salvataggi del librogame.
- La chat web usa OpenAI API e una propria persistenza: non è possibile incorporare/sincronizzare automaticamente questa conversazione ChatGPT.
- Il simulatore Showdown è l'autorità per mosse, legalità, danni e risultati; il Master non può sovrascrivere gli esiti.

## Modalità partita
1. Manuale: utente comanda Luke, avversario gestito da AI.
2. Automatica: AI comanda entrambi, utente spettatore.
3. Selezione per singolo match, senza modificare il salvataggio della competizione.

## Pipeline
1. Prepartita: sorteggi, teste di serie, squadre, statistiche, presentazione stile Champions.
2. Battle: sessione simulatore Pokémon Showdown; protocollo turni e comandi, replay e log salvati.
3. Postpartita: analisi basata solo su eventi del log (prediction, switch, gestione risorse, KO, turni chiave), con citazioni dei turni.
4. Persistenza: risultato, classifica, storia, replay, stato del torneo; ripresa su mobile.

## Contratto minimo di sessione
```json
{
  "matchId": "wc2060-group-a-001",
  "tournamentYear": 2060,
  "playerTrainerId": "luke",
  "controlMode": "manual",
  "battleFormat": "historia-6v6",
  "battleStatus": "pending",
  "showdownBattleId": null,
  "replayUrl": null,
  "logPath": null,
  "result": null
}
```

## Audit / rischi da risolvere prima di implementare
- Identificare la vecchia interfaccia web: i percorsi `web/package.json`, `apps/web/package.json`, `src/web/package.json`, `historia/package.json` non risultano presenti sul ramo; ricerca completa ancora necessaria.
- Stabilire se usare il simulatore Showdown self-hosted oppure un bridge verso server esterno. L'interfaccia pubblica Showdown non garantisce incorporamento o API di controllo per terze parti.
- Validare il formato custom con Mega + Dynamax e gli altri vincoli canonici; non assumere compatibilità nativa.
- Definire un AI battle controller che invii soltanto comandi legali, gestisca timeout e salvi replay.
- Proteggere chiavi OpenAI lato server, autenticazione, rate limit e costi.
- Testare replay deterministici, ripresa sessioni, mobile e persistenza transazionale.

## Criteri di completamento
- Test automatici green e prova reale di battaglia manuale/AI.
- Nessuna simulazione fittizia presentata come Showdown.
- Analisi postpartita fedele al log e torneo aggiornato una sola volta per match.
- PR review prima del merge sul ramo Historia; nessun merge automatico su bookgame-canonical.
