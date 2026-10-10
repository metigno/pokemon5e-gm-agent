# Verifica della versione pubblicata — 10 ottobre 2026

PR #140 unita dopo CI GitHub SUCCESS (run 38049908022). Railway deployment `67542547-040a-47b0-ba7b-ea9b99845738` SUCCESS, commit `5c8b63e8c5f084fc5a6d8c0f4b5ee3d5c635f40e`.

## Risultato sul sito pubblico

Account di test separato, roster automatici originali: campagna fino a Lucas campione WHAT-IF, **63 risultati ordinari unici + 1 spareggio reale**, replay verificati per ogni incontro. Sorteggio e 48 risultati conservati dopo logout-all/login. Ultima sessione di test revocata dopo la finale. Nessuno slot utente esistente è stato modificato.

La campagna è stata ripresa dal client di test durante i gironi; i limiti di due battaglie attive per sessione sono stati rispettati attendendo disponibilità. Il server di produzione non è stato riavviato artificialmente: crash/restart sono già coperti dai test locali e CI, ma questa prova pubblica certifica logout/login e finale, non un restart remoto controllato.

`/api/ready`: read-write. `/api/status`: formato historia, aiConfigured false, authMode accounts. `/api/rosters/2060` autenticata: 35 roster disponibili. HTML pubblico identico al client testato (SHA256 `2fca7c473238adab5aef155c3358ee0cc48f5c6cb64e050663ae9a4cce1a8c94`), CSP presente; browser cloud mostra il pulsante Luke 2060 e fixture tecniche separate.

## Dati conclusivi

```json
{
  "site": "https://pokemon-gpt-historia-web-production.up.railway.app",
  "commit": "5c8b63e8c5f084fc5a6d8c0f4b5ee3d5c635f40e",
  "testedAt": "2026-10-10T12:08:04.804Z",
  "ordinaryMatches": 63,
  "playoffs": 1,
  "champion": "Lucas",
  "seed": 180772278,
  "rosters": 35,
  "verifiedReplays": true,
  "logoutLoginResume": true,
  "productionRestartTested": false,
  "whatIf": true
}
```

## Log della ripresa e fase finale

```text
LIVE: Historia ready; all 35 rosters available; isolated test account created
LIVE MATCH 2060-GB-D3-M2 verified; ordinary results 11
LIVE MATCH 2060-GB-D2-M1 verified; ordinary results 11
LIVE MATCH 2060-GB-D3-M1 verified; ordinary results 12
LIVE MATCH 2060-GB-D2-M2 verified; ordinary results 12
LIVE MATCH 2060-GC-D2-M2 verified; ordinary results 13
LIVE MATCH 2060-GC-D1-M2 verified; ordinary results 14
LIVE MATCH 2060-GC-D2-M1 verified; ordinary results 15
LIVE MATCH 2060-GC-D1-M1 verified; ordinary results 16
LIVE MATCH 2060-GC-D3-M2 verified; ordinary results 17
LIVE MATCH 2060-GC-D3-M1 verified; ordinary results 18
LIVE MATCH 2060-GD-D3-M2 verified; ordinary results 19
LIVE MATCH 2060-GD-D1-M2 verified; ordinary results 20
LIVE MATCH 2060-GD-D3-M1 verified; ordinary results 21
LIVE MATCH 2060-GD-D1-M1 verified; ordinary results 22
LIVE MATCH 2060-GD-D2-M2 verified; ordinary results 23
LIVE MATCH 2060-GD-D2-M1 verified; ordinary results 24
LIVE MATCH 2060-GE-D2-M1 verified; ordinary results 25
LIVE MATCH 2060-GE-D1-M1 verified; ordinary results 26
LIVE MATCH 2060-GE-D3-M1 verified; ordinary results 27
LIVE MATCH 2060-GE-D3-M2 verified; ordinary results 28
LIVE MATCH 2060-GE-D2-M2 verified; ordinary results 29
LIVE MATCH 2060-GE-D1-M2 verified; ordinary results 30
LIVE MATCH 2060-GF-D2-M2 verified; ordinary results 31
LIVE MATCH 2060-GF-D1-M2 verified; ordinary results 32
LIVE MATCH 2060-GF-D1-M1 verified; ordinary results 33
LIVE MATCH 2060-GF-D2-M1 verified; ordinary results 34
LIVE MATCH 2060-GF-D3-M1 verified; ordinary results 35
LIVE MATCH 2060-GF-D3-M2 verified; ordinary results 36
LIVE MATCH 2060-GG-D1-M1 verified; ordinary results 37
LIVE MATCH 2060-GG-D3-M2 verified; ordinary results 38
LIVE MATCH 2060-GG-D1-M2 verified; ordinary results 40
LIVE MATCH 2060-GG-D3-M1 verified; ordinary results 39
LIVE MATCH 2060-GG-D2-M2 verified; ordinary results 41
LIVE MATCH 2060-GG-D2-M1 verified; ordinary results 42
LIVE MATCH 2060-GH-D1-M2 verified; ordinary results 43
LIVE MATCH 2060-GH-D2-M2 verified; ordinary results 44
LIVE MATCH 2060-GH-D2-M1 verified; ordinary results 45
LIVE MATCH 2060-GH-D1-M1 verified; ordinary results 46
LIVE MATCH 2060-GH-D3-M2 verified; ordinary results 47
LIVE MATCH 2060-GH-D3-M1 verified; ordinary results 48
LIVE: logout/login restored same draw and 48 results
LIVE MATCH 2060-PF-B6-K2-R1-M1 verified; ordinary results 48
LIVE MATCH R16-2 verified; ordinary results 49
LIVE MATCH R16-1 verified; ordinary results 50
LIVE MATCH R16-3 verified; ordinary results 51
LIVE MATCH R16-4 verified; ordinary results 52
LIVE MATCH R16-5 verified; ordinary results 53
LIVE MATCH R16-6 verified; ordinary results 54
LIVE MATCH R16-8 verified; ordinary results 55
LIVE MATCH R16-7 verified; ordinary results 56
LIVE MATCH quarterfinal-1 verified; ordinary results 57
LIVE MATCH quarterfinal-4 verified; ordinary results 58
LIVE MATCH quarterfinal-2 verified; ordinary results 59
LIVE MATCH quarterfinal-3 verified; ordinary results 60
LIVE MATCH semifinal-1 verified; ordinary results 61
LIVE MATCH semifinal-2 verified; ordinary results 62
LIVE MATCH final-1 verified; ordinary results 63
LIVE WORLD CUP PASS {"site":"https://pokemon-gpt-historia-web-production.up.railway.app","commit":"5c8b63e8c5f084fc5a6d8c0f4b5ee3d5c635f40e","testedAt":"2026-10-10T12:08:04.804Z","ordinaryMatches":63,"playoffs":1,"champion":"Lucas","seed":180772278,"rosters":35,"verifiedReplays":true,"logoutLoginResume":true,"productionRestartTested":false,"whatIf":true}

```

## Limiti residui

OPENAI_API_KEY manca; nessuna chiamata Master reale certificata. Rimangono i limiti documentati in REPORT-2060.md: fonti ufficiali 2060/classificazione/spareggi, relazioni strutturate, profili tattici completi, Android fisico, verifica di tutti gli sprite remoti e backup/ripristino del volume Railway. Nessun risultato WHAT-IF modifica il canon fino al 2056.
