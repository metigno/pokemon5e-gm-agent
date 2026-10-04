# P5E LIBROGAME — M01 MODULE DESIGN

**Modulo:** M1 — Le Prime Strade  
**Stato:** IMPLEMENTATION-READY DESIGN  
**Progetto:** Pokémon 5e Digital Librogame / Librogame5e  
**Branch:** pokemon5e-digital-bookgame  
**Trainer level band:** 1–3  
**Circuit Rank:** F → E  
**Area primaria:** Campus Licenze → Via delle Ginestre → Valedarsena → Fattoria del Vento  
**NPC-Ancora:** Blue  
**FRIEND_BEAT:** obbligatorio, difficoltà FACILE

---

# 0. AUTORITÀ E VINCOLI

Ordine di autorità:

1. P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md
2. P5E_LIBROGAME_12_MODULES_MASTER.md
3. campaign/events/MAIN_EVENT_GRAPH.json
4. campaign/events/INTRO_CHAIN.md
5. campaign/world/RANK_CHECKPOINTS.json
6. dati e regole Pokémon 5e pin-nati localmente
7. questo documento

Questo file NON riscrive l'intro e NON sostituisce il motore.

INTRO_FIVE resta l'apertura canonica.

Il primo nodo di M1 parte quando:

- intro_complete = true;
- world_day >= 1;
- free_roam = true;
- current_rank = F;
- il protagonista possiede il proprio starter canonico;
- gli altri quattro membri dei Five esistono già come NPC persistenti.

Il modulo deve rispettare:

- nessun dialogo forzato del protagonista;
- nessuna emozione imposta al protagonista;
- niente level scaling invisibile;
- niente Fakémon;
- niente CR narrativi inventati;
- niente risultato di battaglia predeterminato;
- niente cattura obbligatoria;
- niente Blue come boss obbligatorio;
- niente supervillain;
- mondo persistente anche se il player ignora i problemi;
- tiri e combattimenti risolti dal motore Pokémon 5e;
- DC non mostrata prima del tiro;
- conseguenze scritte dopo la risoluzione meccanica.

---

# 1. FUNZIONE DEL MODULO

M1 deve trasformare l'apertura condivisa dei Five in una vera carriera individuale.

Il giocatore deve capire attraverso il gioco, non attraverso un tutorial astratto, che ora può:

- scegliere dove andare;
- incontrare fauna che non esiste per farsi combattere;
- accettare o ignorare lavori;
- catturare Pokémon;
- affrontare trainer;
- perdere senza game over automatico;
- costruire reputazione;
- vedere amici prendere strade diverse;
- incontrare trainer esterni ai Five;
- prepararsi al primo Promotion Trial.

Tema:

**“Adesso nessuno ti dice più cosa devi fare.”**

Il modulo non deve sembrare un corridoio Campus → boss.

È una piccola area semi-aperta con un checkpoint competitivo finale.

---

# 2. LAYER DEL MODULO

## 2.1 Visible layer

Il player vede:

- Campus appena lasciato;
- Via delle Ginestre;
- fauna lungo la strada;
- Valedarsena come primo vero hub;
- Job Board;
- Centro Pokémon;
- Trainer Shop;
- Arena Civica;
- Fattoria del Vento;
- lavori locali;
- rookie trainer;
- Blue;
- almeno un amico dei Five.

## 2.2 Living layer

Mentre il player decide cosa fare:

- gli amici iniziano schedule indipendenti;
- job pubblici possono essere presi da altri;
- trainer disputano match senza aspettare il player;
- fauna cambia posizione in risposta a rumore, lavori e traffico;
- Blue segue la propria carriera;
- il calendario dell'Arena Civica procede;
- eventi possono chiudersi o mutare.

## 2.3 Conflict layer

Valedarsena è sotto pressione logistica.

Manutenzione di strade, canali, magazzini e aree rurali sta disturbando habitat vicini.

Effetti possibili:

- Pokémon più vicini alle strade;
- animali difensivi in zone frequentate;
- piccoli danni a recinti;
- avvistamenti inconsueti;
- job di controllo fauna;
- incomprensioni tra lavoratori, trainer e ranger.

Non esiste una mente criminale dietro M1.

## 2.4 Secret layer

La spiegazione profonda non è “qualcuno sta attaccando i Pokémon”.

La causa è una combinazione di:

- interventi di manutenzione sovrapposti;
- rumore;
- illuminazione;
- movimento merci;
- recinzioni temporanee;
- spostamento di piccoli habitat e fonti d'acqua.

Il player può capire tutto, una parte o niente.

La scoperta cambia come alcune scene vengono risolte, ma non crea una soluzione magica unica.

## 2.5 Player-impact layer

Le azioni del player possono cambiare:

- stato dell'Houndour di Ginestre;
- disponibilità di alcuni job;
- rapporto con ranger/lavoratori;
- reputazione locale iniziale;
- rapporto con l'amico selezionato per FRIEND_BEAT_01;
- primo contatto con Blue;
- disponibilità o stato di specifici incontri selvatici;
- preparazione al Trial;
- tempo impiegato per raggiungere Rank E.

---

# 3. CAST

## 3.1 The Five

Il protagonista è uno fra:

- Luke — Hisuian Growlithe;
- Mattew — Eevee;
- Daniel — Gastly;
- Edward — Totodile;
- Fab — Koffing.

Gli altri quattro sono NPC persistenti.

M1 non deve tenerli tutti accanto al player.

Devono iniziare a divergere.

## 3.2 Blue — NPC-Ancora

Identità early-game:

- giovane;
- competitivo;
- orgoglioso;
- tecnicamente serio;
- vuole misurare rapidamente il livello reale delle persone che incontra.

Ace di traiettoria:

Squirtle → Blastoise → Mega Blastoise.

In M1 Blue deve usare soltanto uno stato early-game legale e coerente.

Il roster mondiale non viene anticipato.

Funzione narrativa:

Blue mostra al player un rookie che prende la competizione molto sul serio senza essere ancora il trainer maturo della sua versione futura.

Blue:

- può osservare;
- può competere nello stesso ambiente;
- può collaborare per interesse pratico;
- può provocare verbalmente;
- può rifiutare di perdere tempo;
- può affrontare il player solo se la situazione lo rende realmente possibile.

Blue NON:

- è il villain;
- controlla il problema ecologico;
- deve perdere contro il player;
- deve diventare amico;
- deve combattere per forza.

Stato minimo persistente:

- blue_met;
- blue_relationship_state;
- blue_m1_result_context;
- blue_current_schedule;
- blue_rank_state;
- blue_team_stage.

## 3.3 NPC locali già canonici

Valedarsena può introdurre, quando necessario:

- Sera Noll — coordinatrice Job Board;
- Toma Ferren — Trainer Shop;
- Dott.ssa Mira Venn — Pokécenter;
- Bram Alder — logistica magazzini;
- Ranger Elio Mar — fauna urbana.

Non devono comparire tutti nella stessa scena.

## 3.4 Ruoli locali senza nome obbligatorio

M1 può usare:

- istruttore Arena Civica;
- addetto Fattoria del Vento;
- rookie challenger;
- operaio manutenzione;
- autista/corriere;
- pescatore o addetto ai canali;
- passanti/trainer di background.

Se un ruolo non richiede persistenza individuale, non serve trasformarlo in un nuovo personaggio importante.

---

# 4. STRUTTURA MACRO

~~~text
INTRO_FIVE completata
        ↓
M1_00_RELEASE
        ↓
M1_01_FIRST_ROAD
        ↓
M1_02_HOUNDOUR_GINESTRE
        ↓
   libera scelta
   ↙        ↓        ↘
Valedarsena  Fattoria  esplorazione/job/sparring
   ↘        ↓        ↙
     M1_WORLD_PRESSURE
            ↓
   Blue / Friend Beat / Official Match
            ↓
       FIVE_ROADS
            ↓
    preparazione Trial
            ↓
      Trial F → E
       ↙        ↘
   sconfitta    vittoria
      ↓           ↓
resta Rank F   Rank E
      ↘           ↙
      mondo continua
~~~

La riconvergenza è sul Promotion Trial, non su un ordine fisso di scene.

---

# 5. EVENTI CANONICI RIUTILIZZATI

M1 deve riutilizzare, non duplicare:

- INTRO_FIVE
- A1_FIRST_ROAD
- A1_WORLD_MOVES
- A1_FIRST_OFFICIAL
- A1_FIVE_ROADS
- A1_FIRST_GATE
- SQ_GINESTRE_FIRST_SPARRING
- SQ_FARM_HERD_HANDS
- scena esistente first-road.json
- encounter HOUNDOUR_GINESTRE_001

Il contenuto già funzionante è parte del modulo.

Non va riscritto soltanto per uniformare i nomi.

---

# 6. SCENE / EVENT GRAPH DI M1

## M1_00 — Release to the World

**Tipo:** transition / free-roam release  
**Ingresso:** INTRO_06 completata

Obiettivo:

far sentire il cambio da cerimonia guidata a mondo aperto.

La scena:

- mostra i nodi raggiungibili;
- lascia scegliere al player;
- non assegna automaticamente una main quest;
- ricorda diegeticamente che il Promotion Trial esiste senza trasformarlo in un ordine.

Uscita:

A1_FIRST_ROAD può attivarsi.

---

## M1_01 — The First Road

**Evento canonico:** A1_FIRST_ROAD  
**Zona:** AST-GINESTRE  
**Livello Trainer previsto:** 1–2

Obiettivi:

- insegnare viaggio e tempo;
- mostrare che le strade sono luoghi vivi;
- permettere trainer encounter opzionali;
- introdurre fauna non automaticamente ostile.

Possibili contenuti:

- rookie in cammino;
- tracce;
- piccoli segni dei lavori;
- deviazione verso la Fattoria;
- accesso verso Valedarsena.

La scena non deve bloccare il player finché non ha “fatto tutto”.

---

## M1_02 — Houndour di Ginestre

**Implementazione esistente:** bookgame/content/scenes/first-road.json  
**Encounter:** HOUNDOUR_GINESTRE_001

Questo è il primo encounter ecologico di riferimento.

Lo Houndour:

- non sta cercando una battaglia;
- difende spazio e possibilità di fuga;
- può calmarsi;
- può essere combattuto;
- può fuggire;
- può essere catturato legalmente;
- può essere lasciato in pace.

Check esistente:

Animal Handling con DC 12, nascosta nella UI.

Flag esistenti da preservare:

- houndour_ginestre_disposition;
- houndour_ginestre_escalation.

M1 deve aggiungere callback futuri alle conseguenze, non cambiare il significato dell'incontro.

Esempi di callback:

- Houndour catturato → possibile primo secondo Pokémon;
- Houndour calmato → Ranger Elio può riconoscere il tipo di comportamento descritto;
- Houndour costretto a fuggire → nessuna punizione morale automatica, ma cambia la posizione dell'animale;
- escalation evitata → piccolo segnale positivo di gestione fauna.

---

## M1_03 — Primo bivio reale

Dopo Ginestre il player deve poter scegliere almeno fra:

- continuare verso Valedarsena;
- deviare verso Fattoria del Vento;
- accettare/creare un'interazione locale disponibile;
- esplorare il nodo finché il tempo e gli eventi lo consentono.

Nessuna scelta è la “risposta corretta”.

La struttura deve restare a diamante.

---

## M1_04 — Valedarsena: First Arrival

**Zona:** VAL-CITY

La prima visita introduce soltanto ciò che serve.

Priorità:

- orientamento;
- Centro Pokémon;
- Via Allenatori;
- Job Board;
- Arena Civica;
- possibilità di spendere denaro;
- possibilità di chiedere informazioni.

Non mostrare dieci tutorial consecutivi.

Il player deve poter ignorare il Job Board e andare altrove.

Set consigliati:

- first_settlement_reached = true;
- valedarsena_discovered = true.

Questo può attivare A1_WORLD_MOVES.

---

## M1_05 — Job Board

**NPC possibile:** Sera Noll

La board deve essere competitiva e temporale.

M1 usa almeno:

- SQ_FARM_HERD_HANDS — “Recinti aperti”;
- possibili lavori urbani/di consegna già supportati dal catalogo;
- notizie di manutenzione/fauna senza obbligo di accettare.

Regola:

un job ignorato non resta congelato per sempre.

Può:

- essere preso da un altro trainer;
- cambiare;
- scadere;
- produrre una conseguenza off-screen.

---

## M1_06 — Fattoria del Vento / Recinti aperti

**Quest canonica:** SQ_FARM_HERD_HANDS  
**Zona:** AST-FARM  
**Livello:** 1–3

Hook:

un addetto e un giovane trainer cercano di recuperare Pokémon dispersi senza spaventarli.

Approcci possibili:

- osservazione;
- Animal Handling;
- cooperazione con il proprio Pokémon;
- deviazione/recupero fisico;
- battaglia soltanto se un animale diventa realmente pericoloso;
- chiedere aiuto;
- abbandonare.

FRIEND_BEAT_01 può inserirsi qui se un amico è disponibile.

Il modulo non stabilisce a priori quale specie venga catturata.

Le specie devono arrivare dal pool ecologico autorizzato della zona e dai dati P5e reali.

---

## M1_07 — The World Moves Without You

**Evento canonico:** A1_WORLD_MOVES

Trigger:

- world_day >= 3
  oppure
- first_settlement_reached.

Questa è la materializzazione del conflitto ambientale di M1.

Stati consigliati:

- pressure_unnoticed;
- pressure_noticed;
- pressure_investigated;
- pressure_partially_resolved;
- pressure_resolved_local;
- pressure_ignored;
- pressure_resolved_offscreen.

Il player può scoprire che gli avvistamenti e i piccoli problemi non sono eventi separati.

Possibili fonti:

- Ranger Elio Mar;
- Job Board;
- addetti Fattoria;
- lavoratori;
- osservazione diretta;
- comportamento della fauna.

Non creare un singolo “colpevole finale”.

---

## M1_08 — Blue Enters the Circuit

Blue entra in modo causale, preferibilmente a Valedarsena o in un'attività collegata al circuito.

Versioni valide:

A. Arena Civica  
Blue sta registrando un match o chiedendo informazioni sul Trial.

B. Job/field overlap  
Blue ha accettato un incarico separato che interseca quello del player.

C. Trainer Shop / Center  
Incontro breve dopo un risultato locale.

La scena deve sempre lasciare al player libertà di:

- parlargli;
- ignorarlo;
- rispondergli in modo competitivo;
- chiedergli informazioni;
- eventualmente accettare una sfida se legalmente disponibile.

Blue non deve dare un monologo sul futuro Mondiale.

La sua ambizione si vede nel comportamento.

---

## M1_09 — FRIEND_BEAT_01

**Obbligatorio.**

Il motore seleziona uno degli altri quattro Five in base a:

1. schedule reale;
2. posizione;
3. relazione;
4. eventi recenti;
5. compatibilità col contenuto disponibile.

Forme preferite in M1:

- piccolo incarico condiviso;
- esplorazione;
- aiuto con fauna;
- sparring;
- incontro in città;
- match ufficiale se il calendario lo produce.

Se c'è una battaglia:

- early-game;
- stato reale dei due roster;
- preferenza per 1v1 quando coerente;
- nessun buff;
- nessun vincitore deciso.

Esito persistente:

- friend_beat_01_complete = true;
- friend_beat_01_friend_id;
- friend_beat_01_type;
- eventuale result reale.

---

## M1_10 — First Official Match

**Evento canonico:** A1_FIRST_OFFICIAL  
**Trigger:** trainer_level >= 2 oppure official_match_opportunity

Questo NON è il Promotion Trial.

È il primo match sanzionato non-tutorial.

Formato:

- 1 Pokémon;
- Singles;
- avversario STANDARD;
- generic trainer oppure friend se causalmente valido.

Esiti:

- win;
- loss;
- eventuale forfeit/invalidity solo se regole reali lo producono.

Una sconfitta non blocca M1.

Questa scena insegna:

- registrazione;
- regole ufficiali;
- stato persistente dopo un match;
- differenza tra “ho combattuto” e “ho superato un gate”.

---

## M1_11 — Second Pokémon / Roster Preparation

Il Promotion Trial F→E richiede:

**Official roster size = 2.**

M1 deve offrire più opportunità legali per arrivare a due Pokémon:

- Houndour di Ginestre;
- fauna di AST-GINESTRE;
- fauna di AST-FARM;
- fauna urbana/rurale legalmente incontrata;
- future opportunità generate dai pool autorizzati.

Regole:

- nessun Pokémon regalo creato per risolvere il requisito;
- nessuna cattura automatica;
- nessun “prestito” custom per aggirare il Trial;
- cattura secondo Pokémon 5e;
- specie/livello/stato veri.

Se il player mantiene un solo Pokémon:

- può continuare a giocare;
- il Trial resta non registrabile;
- Rank resta F.

---

## M1_12 — Five Roads

**Evento canonico:** A1_FIVE_ROADS

Trigger:

- trainer_level >= 3
  oppure
- rank_at_least_E
  oppure
- world_day >= 7.

Funzione:

rendere visibile che gli amici non sono party members permanenti.

Almeno uno:

- lascia l'area;
- accetta un lavoro altrove;
- prepara un proprio Trial;
- cambia percorso;
- ottiene un proprio risultato.

Gli altri vengono aggiornati off-screen in modo onesto.

Set:

- friends_split = true;
- schedule individuali aggiornati.

La scena non impone al player nostalgia, orgoglio o tristezza.

Mostra i fatti e lascia reagire.

---

## M1_13 — Trial Registration

Zona:

Valedarsena — Arena Civica.

Requisiti meccanici:

- current_rank = F;
- Trial disponibile;
- roster legale di 2 Pokémon;
- nessun requisito inventato dal layer narrativo.

L'Arena rende chiaro il focus:

**fondamentali: comando, sicurezza e gestione di due Pokémon.**

Il player può:

- registrarsi;
- rimandare;
- curarsi/prepararsi;
- continuare free-roam.

---

## M1_14 — Promotion Trial F→E

**Evento:** A1_FIRST_GATE  
**Checkpoint:** RANK_F_TO_E  
**Venue:** Arena Civica  
**Trainer level previsto:** 2–3  
**Battle:** Singles  
**Official roster:** 2  
**Opponents:** 1  
**Difficulty:** HARD per la fascia, senza scaling invisibile  
**Win required:** sì  
**Retry:** sì

Avversario:

gate staff persistente con roster fisso per questa fascia.

Non usare Blue automaticamente.

Non usare un amico automaticamente.

Il roster del gate deve essere definito nei dati di implementazione e validato contro Pokémon 5e.

---

## M1_15A — Trial Loss

Se il player perde:

- current_rank resta F;
- accesso Rank E resta chiuso;
- risultato viene registrato;
- HP/PP/condizioni seguono il risultato reale;
- il mondo continua;
- il Trial resta retryable;
- nessun reset narrativo.

NPC e amici possono avanzare mentre il player prepara il retry.

---

## M1_15B — Trial Win

Se il player vince:

- current_rank = E;
- Rank E access band si apre;
- M1 può chiudere formalmente;
- Blue e amici conservano il loro stato reale;
- quest non risolte continuano secondo le loro regole;
- M2 diventa raggiungibile.

La vittoria non cancella:

- fauna pressure;
- job falliti;
- rapporti;
- Houndour state;
- risultati competitivi;
- schedule NPC.

---

# 7. BLUE — ARCO M1

Blue deve avere tre possibili intensità di presenza.

## Presenza minima

- incontro breve;
- riconoscimento reciproco;
- nessuna battaglia;
- Blue continua la propria schedule.

## Presenza media

- incontro + conversazione;
- intersezione con Arena/job;
- un confronto tecnico sulle scelte;
- successivo callback dopo un risultato.

## Presenza alta

- incontro;
- attività condivisa o competitiva;
- possibile match legale;
- risultato persistente.

Tutte e tre le versioni sono valide.

M1 non è incompleto se il player non batte Blue.

M1 è incompleto se Blue non viene introdotto in alcuna forma.

---

# 8. FAUNA E INCONTRI

Zone autorizzate M1:

## AST-GINESTRE

Biomi:

- field;
- grassland;
- riverside.

## AST-FARM

Biomi:

- field;
- grassland;
- pond.

## VAL-CITY

Biomi:

- city;
- riverside.

## VAL-WAREHOUSES

Biomi:

- industrial;
- city.

La specie viene selezionata soltanto dai dati ecologici autorizzati.

Regole:

- non mostrare la tabella completa al player;
- non ogni incontro è combattimento;
- fuga e osservazione sono esiti validi;
- capture resta possibile per ordinary wild Pokémon;
- Legendary/Mythical/Paradox non entrano casualmente in M1;
- niente Alpha/Beta se il pool/trigger non lo autorizza.

---

# 9. SIDE CONTENT MINIMO

M1 deve contenere almeno:

1. Houndour di Ginestre;
2. SQ_GINESTRE_FIRST_SPARRING — “Due chilometri di coraggio”;
3. SQ_FARM_HERD_HANDS — “Recinti aperti”;
4. almeno un job urbano o logistico dal Job Board;
5. almeno un'attività competitiva non obbligatoria.

Non tutte devono essere completate in una singola run.

---

# 10. CONSEGUENZE SE IGNORATO

## Houndour ignorato

Il Pokémon continua la propria traiettoria ecologica.

Non aspetta il player nello stesso punto per sempre.

## Fauna pressure ignorata

Dopo la finestra prevista:

- ranger/lavoratori intervengono senza il player;
- alcune opportunità spariscono;
- alcune conseguenze possono peggiorare prima di stabilizzarsi;
- il player non riceve ricompense/reputazione per lavoro non svolto.

## Job ignorato

Può essere:

- completato da un NPC;
- fallito;
- ritirato;
- ripubblicato in forma modificata.

## Blue ignorato

Blue continua:

- match;
- training;
- eventuale Trial;
- viaggio.

Il suo futuro incontro deve riflettere che il player non gli ha dato attenzione.

## Trial rimandato

Il player resta Rank F.

Il mondo non si ferma.

---

# 11. FLAG PERSISTENTI MINIMI

Da riutilizzare se già esistenti; da aggiungere solo se non duplicano stato equivalente.

- intro_complete
- free_roam
- first_settlement_reached
- valedarsena_discovered
- houndour_ginestre_disposition
- houndour_ginestre_escalation
- m1_world_pressure_state
- m1_world_pressure_known
- m1_world_pressure_player_involved
- blue_met
- blue_relationship_state
- blue_m1_result_context
- friend_beat_01_complete
- friend_beat_01_friend_id
- friend_beat_01_type
- first_official_resolved
- friends_split
- rank_trial_F_E_available
- rank_trial_F_E_attempts
- rank_trial_F_E_best_result
- current_rank

Non duplicare:

- HP;
- PP;
- Pokémon state;
- inventory;
- money;
- Trainer level;
- Pokémon level;
- injuries;
- schedule;

se sono già presenti nei rispettivi sistemi.

---

# 12. QUEST JOURNAL

M1 deve dimostrare le categorie:

- Active;
- Completed;
- Failed.

Esempi:

“Recinti aperti” può:

- Active → Completed;
- Active → Failed;
- non essere mai accettata.

Il Trial non va trattato come normale side quest.

È un competitive gate persistente.

---

# 13. TEMPO

Tempi topologici già canonici:

- Campus → Ginestre: 20 minuti;
- Ginestre → Valedarsena: 70 minuti;
- Ginestre → Fattoria del Vento: 70 minuti.

M1 deve far avanzare il tempo realmente.

Il player può arrivare in città a orari diversi e trovare:

- servizi;
- job;
- NPC;
- fauna;
- Arena;

in stati diversi.

Il modulo non deve richiedere che tutto accada nel Giorno 1.

---

# 14. CHECK DESIGN

Regola generale:

tirare soltanto con incertezza + rischio + conseguenza.

Check possibili in M1:

- Animal Handling;
- Perception;
- Investigation;
- Persuasion;
- Intimidation;
- Athletics;
- altri check Pokémon 5e legalmente pertinenti.

Le scelte mostrano il tipo di check.

La DC non viene mostrata.

Il testo di esito deve essere narrativo.

Esempio UI:

**Esamino le tracce vicino al recinto. (CT Perception)**

Dopo la scelta:

**d20 + bonus = totale**

Poi narrazione del risultato.

---

# 15. COMBAT DESIGN

Battaglie possibili in M1:

- Houndour wild encounter;
- rookie sparring;
- FRIEND_BEAT sparring;
- first official match;
- eventuali encounter causali;
- Promotion Trial.

Tutte passano dal resolver Pokémon 5e.

Il layer narrativo non decide:

- danno;
- AC;
- hit;
- status;
- range;
- movimento;
- PP;
- capture;
- faint/death;
- risultato.

Al ritorno dal resolver, la scena seleziona il branch corretto.

---

# 16. DEATH / SAFETY

M1 non rende il mondo magicamente non-letale.

Contesto:

- Campus e match ufficiali sono supervisionati;
- Trial e Arena usano contesto ufficiale;
- incontri selvatici possono essere realmente pericolosi secondo Pokémon 5e e situazione;
- permadeath resta parte del motore dove applicabile.

Non usare la narrativa per annullare un esito meccanico valido.

---

# 17. USCITE DI M1

## Exit A — Promotion achieved

Condizioni:

- Rank E;
- Blue introdotto;
- FRIEND_BEAT_01 completato;
- Five schedules separate;
- M2 accessibile.

## Exit B — Still Rank F

Il player può aver:

- perso il Trial;
- non ancora due Pokémon;
- rimandato la registrazione;
- scelto free-roam.

Il gioco continua in M1.

## Exit C — Delayed career path

Il player può impiegare molti giorni.

Gli eventi temporali continuano.

Non esiste reset del modulo.

---

# 18. CALLBACK PER M2+

Da preservare:

- come è stato trattato Houndour;
- quali job sono stati completati;
- reputazione Valedarsena;
- rapporto con Ranger Elio;
- rapporto con Blue;
- risultato First Official;
- risultato Trial;
- FRIEND_BEAT_01;
- quale amico è partito dove;
- seconda cattura del player;
- eventuali quest fallite;
- stato della fauna pressure.

M2 deve poter leggere questi dati senza riscriverli.

---

# 19. DEFINITION OF DONE M1

M1 è DESIGN COMPLETE soltanto se:

- [x] area e timeline definite;
- [x] visible/living/conflict/secret/player-impact layer definiti;
- [x] Blue integrato senza trasformarlo in boss;
- [x] cast locale riusa NPC canonici;
- [x] side quest minime identificate;
- [x] main beats mappati;
- [x] conseguenze se ignorato definite;
- [x] flag persistenti definiti;
- [x] collegamento da INTRO_FIVE definito;
- [x] collegamento a M2 definito;
- [x] FRIEND_BEAT_01 obbligatorio;
- [x] difficoltà Friend Beat FACILE e basata sullo stato reale;
- [x] nessun level scaling invisibile;
- [x] nessun dialogo/emozione imposta al player;
- [x] compatibilità Pokémon 5e esplicita;
- [x] callback futuri definiti.

---

# 20. PROSSIMO PASSO TECNICO

Dopo questo design, l'implementazione M1 va divisa in asset piccoli e validabili:

1. scene graph M1;
2. location/event bindings;
3. Job Board entries;
4. FRIEND_BEAT_01 selector;
5. Blue early-stage NPC state;
6. A1_WORLD_MOVES state machine;
7. First Official scene;
8. Five Roads scene;
9. Promotion Trial F→E;
10. callback tests;
11. full M1 playthrough tests con:
   - vittoria;
   - sconfitta;
   - quest ignorate;
   - nessuna cattura iniziale;
   - Houndour catturato;
   - Houndour evitato;
   - Friend Beat con amici diversi;
   - Blue non combattuto;
   - Blue combattuto quando legalmente possibile.

Il target non è “una storia che si legge”.

Il target è:

**un primo modulo rigiocabile in cui la stessa ossatura produce carriere realmente diverse senza mai uscire dalle regole e dal canone.**
