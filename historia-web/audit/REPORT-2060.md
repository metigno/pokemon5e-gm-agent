# Verifica Historia Mondiale 2060 — 10 ottobre 2026

Base verificata: `0200d7b8f068d36fcedc1a588c4669eba641967f`, branch `historia-web-showdown-integration`.
Le modifiche sono destinate a revisione prima del deploy. Nessun salvataggio di produzione, Bookgame, PSC o file di lore canonica è stato modificato. I risultati descritti sotto sono WHAT-IF e non diventano canonici.

| Area | Stato | Evidenza e limite |
|---|---|---|
| Roster | Completo locale | 35 squadre originali compatibili; sei Pokémon e set conservati. Luke: Hisui Alpha senza bonus, Venusaurite, Kyurem-Black, Great Tusk, Blastoise Gmax, Kilowattrel Focus Sash. Il JSON sorgente non cambia. |
| Formato | Parziale | Formato Historia intergenerazionale reale, Mega/Gmax/strumenti/restrizioni provati. Classificazione leggendari esplicita WHAT-IF, non certificata come regolamento canonico ufficiale. |
| Percorso Luke | Completo locale | Allenamento principale usa roster 2060; fixture dimostrative separate e dichiarate. |
| Mondiale | Completo locale WHAT-IF | 48 gironi + 15 knockout reali via HTTP, riavvio dopo gironi, risultati unici, campione Rei. Spareggi separati e persistenti risolti da Showdown. Qualificati ufficiali non certificati. |
| Bot | Parziale | Scelte legali e informazioni pubbliche; immunità/status/hazard migliorati. Cinque profili euristici; altri allenatori usano profilo bilanciato. Non certificata competenza competitiva avanzata. |
| Master e GDR | Parziale / credenziale bloccata | Chat/eventi isolati nello slot; contesto torneo e log verificati; test HTTP con provider simulato. Produzione senza OPENAI_API_KEY. Relazioni numeriche e conseguenze strutturate complete non implementate; corpus canonico completo non disponibile. |
| Interfaccia | Parziale | 20 test Chromium desktop/mobile touch, replay, crash/ripresa, prospettiva classica, no overflow. Nessun Android fisico testato; caricamento di ogni asset sprite remoto non certificato. |
| Persistenza/deploy | Parziale | Isolamento account/slot e backup/ripristino con dati temporanei verificati. Volume Railway dedicato confermato; backup/ripristino del volume remoto non eseguito. Versione nuova non pubblicata. |

## Correzioni principali

- Rimosso blocco erroneo Excadrite/Staraptite: Showdown 0.11.11 contiene Mega Excadrill e Mega Staraptor con statistiche e abilità proprie. Versione e lockfile fissati; Docker e CI usano npm ci.
- Formato dedicato abilita dati Past/Future nel motore Gen8; non basta il riconoscimento del nome. Nessuna Tera o mossa Z. Vincoli Mega/Dmax e divieti Zacian/Zamazenta/Eternatus verificati con log e test.
- Audit riproducibile `node scripts/audit-roster-effects.mjs`; `roster-effects.json` contiene per tutti i 35 roster forme/abilità/statistiche effettive e log del simulatore, hash sorgente e versione. Queste prove diagnostiche dirette non costituiscono input omnisciente ai bot.
- Politica WHAT-IF `repeated-elimination-ladder-v1`: confronto diretto e differenza KO precedono gli spareggi; solo il sottoinsieme ancora pari disputa battaglie reali. L'ordine iniziale viene dal sorteggio persistente, mai dall'alfabeto. Gli spareggi sono aggiuntivi ai 63 incontri.
- Corretta una race che ricreava il journal dopo la conclusione e impediva la finalizzazione HTTP; chiusura e recupero legacy protetti.
- Chat separata per slot, contesto calendario/tabellone/classifiche/eventi; risposte tardive ignorate quando cambia account o slot. Showdown mantiene autorità esclusiva sui risultati.

## Verifiche eseguite

- `npm test` in historia-web: **142 pass, 0 fail**; log `node-tests.log`.
- `node --test historia/test/*.test.mjs`: **34 pass, 0 fail**; log `core-tests.log`.
- `npx playwright test`: **20 pass**, desktop Chromium e emulazione touch mobile; nessun test su telefono fisico.
- Due campagne complete vere: servizio locale e API HTTP. Ultimo HTTP: **Rei**, seed **18680267**, **63** incontri ordinari verificati, riavvio server dopo 48. Ultima campagna servizio: **Silas Crowe**, seed **2445779434**.
- Una precedente campagna HTTP completa ha disputato 63 incontri più 3 spareggi; regression mirata finale conferma tre spareggi reali e preserva il leader con differenza KO unica.
- Trasformazioni reali di tutti i 35 roster; Mega Venusaur/Thick Fat, Gmax Blastoise/G-Max Cannonade, Mega Excadrill/Piercing Drill, Mega Staraptor/Contrary e Mega Rayquaza, effetti Focus Sash e vincoli di trasformazione.
- Scenari tattici, richieste illegali, fog of war, recupero battle interrotta, replay/analisi, isolamento, backup/ripristino offline di soli dati test e integrazione Master con provider simulato.
- Diff e sintassi controllati. Test di torneo con risultati sintetici restano scaffolding separato: le due campagne complete e le prove di meccaniche usano davvero Showdown.

## Deployment osservato

Railway progetto `lega-gpt-showdown`, servizio `pokemon-gpt-historia-web`: deployment `db6b0c54-f71a-4e95-a110-d619657cf1fc`, commit base sopra, SUCCESS; `/api/ready` read-write. Volume `historia-saves` 5000 MB su `/data`. Nomi variabili controllati senza stampare valori: manca OPENAI_API_KEY.
Il sito pubblicato dichiara ancora `gen8customgame`, `aiConfigured:false`; conserva i vecchi testi e blocchi. Un SUCCESS non dimostra l'esecuzione del Mondiale: il completo E2E è stato eseguito sulla revisione locale, non sui salvataggi pubblici.

## Dipendenze residue

1. Approvazione del merge/deploy e smoke test della revisione pubblicata.
2. OPENAI_API_KEY configurata nel solo servizio Historia per chiamate Master reali.
3. Fonte canonica certificata per qualificati 2060, classificazione completa dei leggendari e politica ufficiale spareggi; le politiche implementate restano WHAT-IF.
4. Eventuale sviluppo delle relazioni strutturate/GDR completo e identità tattiche per ogni allenatore, oltre ai profili euristici attuali.
5. Dispositivo Android reale e verifica completa sprite remoti; prova controllata di backup/ripristino del volume Railway senza sovrascrivere dati utenti.
