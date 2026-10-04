# P5E LIBROGAME — MASTER CANONICO DEI 12 MODULI

**Stato:** design/lore convergente dopo audit — 4 ottobre 2026  
**Progetto:** Librogame5e digitale offline-first  
**Repository:** metigno/pokemon5e-gm-agent  
**Branch canonico per questo progetto:** pokemon5e-digital-bookgame  
**Ambito:** contenuto narrativo, world structure, progression, NPC-Ancora, FRIEND_BEAT, Mondiale e postgame.

> Questo documento è il master narrativo dei 12 moduli. Non sostituisce il motore o le regole tecniche definite in P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md. Il combattimento, le schede, gli oggetti, le azioni, le limitazioni e i tiri devono restare Pokémon 5e reali. Nessuna regola narrativa di questo documento può creare scorciatoie meccaniche custom.

---

# 0. PRINCIPI GLOBALI LOCKED

## 0.1 Progetto separato

Librogame5e è separato sia da Pokémon Sports Career (PSC) sia dal progetto principale Pokémon 5e GM Agent.

Non riutilizzare nomi, file o branch PSC.

Non modificare il comportamento dell'Agent ChatGPT per implementare il librogame.

Il librogame vive nel branch:

**pokemon5e-digital-bookgame**

e usa principalmente:

- bookgame/
- campaign/
- canon/

quando compatibili con il progetto.

## 0.2 Prodotto

Il prodotto finale è un vero librogame digitale offline-first:

Nuova Partita → scene → scelte → controlli → tiri → combattimenti → stato persistente → conseguenze.

L'AI/LLM non deve essere necessaria per giocare.

## 0.3 Pokémon 5e

Le regole di gioco devono essere quelle reali del motore Pokémon 5e / Pokémon 5e GM Agent.

Niente:

- CR inventati;
- level scaling invisibile;
- statistiche narrative che sostituiscono le regole;
- azioni UI che cambiano il regolamento;
- Fakémon.

I CR esatti e i roster di battaglia vengono verificati contro i dati P5e in fase di implementazione.

---

# 1. THE FIVE — PROTAGONISTI E AMICI

A Nuova Partita il giocatore sceglie uno fra:

- **Luke** — Hisuian Growlithe
- **Mattew** — Eevee
- **Daniel** — Gastly
- **Edward** — Totodile
- **Fab** — Koffing

Il personaggio scelto diventa il player.

Gli altri quattro diventano NPC persistenti e autonomi.

Formula:

**eligible_friends = THE_FIVE - player_character**

Esempio:

Player Luke → amici NPC = Mattew, Daniel, Edward, Fab.

Gli amici:

- viaggiano;
- combattono;
- catturano Pokémon;
- evolvono;
- guadagnano o perdono reputazione;
- possono ferirsi;
- possono perdere Trial;
- possono qualificarsi o non qualificarsi;
- possono superare il player;
- possono affrontarsi tra loro;
- possono arrivare al Mondiale o restarne fuori.

Nessun catch-up artificiale.

---

# 2. FRIEND_BEAT OBBLIGATORIO — NUOVO LOCK

Ogni modulo M1→M12 deve contenere almeno un'interazione significativa con uno degli altri quattro membri dei Five.

ID concettuale:

**FRIEND_BEAT_01 ... FRIEND_BEAT_12**

Un FRIEND_BEAT valido può essere:

- sparring;
- torneo;
- match ufficiale;
- missione condivisa;
- soccorso;
- esplorazione;
- rivalità;
- telefonata importante;
- incontro casuale;
- problema personale;
- allenamento;
- conseguenza della sua carriera;
- confronto dopo una sconfitta;
- supporto o tensione durante il Mondiale.

Una semplice news non basta se un incontro personale è causalmente plausibile.

## 2.1 Selezione dell'amico

Il motore sceglie l'amico più coerente valutando:

1. disponibilità reale;
2. posizione e viaggio;
3. schedule;
4. relazione col player;
5. chi è stato usato recentemente;
6. eventi irrisolti;
7. livello e stato competitivo reale;
8. compatibilità col modulo.

Nessun teletrasporto narrativo.

## 2.2 Rotazione early game

Nei primi quattro moduli, quando la causalità lo permette, il sistema prova a dare un beat principale a tutti e quattro gli amici.

Non è una sequenza fissa.

Esempio possibile con Luke player:

- M1 Mattew
- M2 Daniel
- M3 Edward
- M4 Fab

Una run diversa può produrre un ordine diverso.

## 2.3 Crescita della difficoltà

La difficoltà degli amici cresce organicamente:

- **FACILE** — primi moduli, pochi Pokémon, poca esperienza;
- **MEDIO** — roster più larghi, prime evoluzioni, stile riconoscibile;
- **DIFFICILE** — trainer professionali, team maturi, preparazione;
- **DIFFICILISSIMO** — Masters / Qualifier / Mondiale.

La difficoltà non buffa artificialmente un amico.

Si usa sempre il suo stato reale.

---

# 3. CONTINUITÀ TRA I MODULI

I moduli non sono episodi isolati.

Persistono:

- Trainer level;
- Pokémon;
- EXP;
- evoluzioni;
- HP/condizioni secondo il sistema;
- inventario;
- denaro;
- reputazione;
- relazioni;
- infortuni;
- ranking;
- Rank;
- risultati;
- side quest;
- flag;
- schedule NPC;
- World state.

La timeline mondiale non si resetta all'inizio di un modulo.

NPC e problemi continuano anche se il player non interviene.

Le conseguenze dei moduli precedenti possono cambiare:

- dialoghi;
- accessi;
- disponibilità NPC;
- rumours;
- prezzi;
- eventi;
- side quest;
- notizie.

---

# 4. PROGRESSIONE AUDITATA E CORRETTA

La progressione Rank canonica è:

**F → E → D → C → B → A → S → World Qualifier → World Championship**

Bande di livello corrette dopo audit del MAIN_EVENT_GRAPH:

| Modulo | Livelli | Rank/Fase |
|---|---:|---|
| M1 | 1–3 | F→E |
| M2 | 3–5 | E→D |
| M3 | 5–9 | D→C |
| M4 | 8–12 | C→B |
| M5 | 11–15 | B→A |
| M6 | 14–18 | A→S |
| M7 | 17–20 | S / Qualifier |
| M8 | 18–20 | Pre-World / Draw |
| M9 | 18–20 | World Groups |
| M10 | 18–20 | R16 + QF |
| M11 | 18–20 | SF + Final |
| M12 | 18–20 | WORLD_EXIT / Postgame |

Le sovrapposizioni sono intenzionali.

## Correzioni importanti

- Meridiana richiede **Rank S**.
- Il Gate del Primo Faro è il checkpoint **A→S**.
- Il World Qualifier è separato dal Rank S.
- Perdere il World Qualifier non consente retry infinito: Last Chance o ciclo successivo.
- Il MAIN_EVENT_GRAPH tecnico contiene tutto il Mondiale in ACT_8.
- M8–M12 sono una suddivisione narrativa dell'ACT_8 e del WORLD_EXIT, non nuovi Act tecnici.
- Non esiste un ACT_9 competitivo canonico dopo il Mondiale.

---

# 5. MAPPA MACRO DI ASTERIA

Territorio Interregionale di Asteria.

Assi principali:

1. Campus → Valedarsena → Via Alta → Meridiana
2. Valedarsena → Bosco Bruma → Borgo Salice → Palude Mirto → Rivafonda
3. Valedarsena → Cava Grigia → Ferravia → Gallerie Ferrox → Monti Ferrox → Altacima → Altopiano Fulgore
4. Valedarsena → Canale delle Ruote → Mareasale → Costa di Sale → Rovine del Primo Faro

Il viaggio può usare:

- piedi;
- bus;
- treno;
- traghetto;
- trasporto privato;
- Pokémon quando legalmente e narrativamente appropriato.

Nessun world scaling.

---

# 6. NPC-ANCORA — FILO MONDIALE

Ogni modulo introduce o usa un personaggio di rilievo che può riapparire al Mondiale.

Progressione locked:

- **M1 — Blue**
- **M2 — N**
- **M3 — Steven Stone**
- **M4 — Archie**
- **M5 — Lance**
- **M6 — Red**
- **M7 — Cynthia**
- **M8 — Astrid Vahl**
- **M9 — Kaia Solari**
- **M10 — Silas Crowe**
- **M11 — Rei**
- **M12 — cast completo / WORLD_EXIT**

Gli Anchor non sono “boss di fine modulo”.

Possono essere:

- rivali;
- alleati;
- conoscenti;
- collaboratori;
- avversari;
- figure ambigue.

Prima del Mondiale la macrotraiettoria può garantirne la qualificazione per costruire il payoff.

Dal momento in cui il Mondiale comincia:

**nessun Anchor ha protezione sui risultati.**

Possono uscire ai gironi, agli ottavi, ai quarti, ecc.

---

# 7. MODULO 1 — LE PRIME STRADE

**Livelli:** 1–3  
**Rank:** F→E  
**Area:** Campus Licenze → Ginestre → Valedarsena → Fattoria del Vento  
**NPC-Ancora:** Blue  
**Tema:** “Adesso nessuno ti dice più cosa devi fare.”  
**Difficoltà Friend Beat:** FACILE

## Funzione

Trasformare i cinque nuovi trainer in individui indipendenti.

## Contenuto

- Intro Professor / creazione personaggio;
- starter personale;
- First Road;
- Houndour di Ginestre;
- arrivo a Valedarsena;
- Job Board;
- primo match ufficiale;
- problema della fauna spostata da lavori e manutenzione;
- Five Roads;
- Trial F→E.

## Conflitto

Valedarsena vive pressione logistica.

Lavori, magazzini, canali e traffico disturbano la fauna.

Non esiste un supervillain.

Il problema deriva da manutenzione sottovalutata e pressione economica.

## Blue

Competitivo, orgoglioso, giovane.

ACE di lungo periodo: linea Squirtle → Blastoise.

Il suo team mondiale finale appartiene alla carriera futura, non al Modulo 1.

## FRIEND_BEAT_01

Prima della separazione uno degli altri quattro deve condividere almeno un momento significativo:

- primo sparring;
- piccolo incarico;
- esplorazione;
- fauna selvatica;
- aiuto reciproco.

Fight consigliato early game:

1 Pokémon vs 1 Pokémon o equivalente P5e appropriato.

## Uscita

- Rank E possibile;
- Blue persistente;
- amici iniziano schedule indipendenti;
- conseguenze di Ginestre persistono.

---

# 8. MODULO 2 — SOTTO LA NEBBIA

**Livelli:** 3–5  
**Rank:** E→D  
**Area:** Bosco Bruma → Borgo Salice → Palude Mirto  
**NPC-Ancora:** N  
**Tema:** “Proteggere un Pokémon e decidere al posto suo non sono sempre la stessa cosa.”  
**Difficoltà Friend Beat:** FACILE→MEDIO

## Funzione

Primo vero conflitto morale e primo crimine organizzato di piccola scala.

## Conflitto

Una rete di cattura illegale sfrutta Bosco Bruma e Palude Mirto.

Non è automaticamente Team Rocket e non è la stessa trama di ogni modulo.

## N

Alta empatia verso i Pokémon.

Può interpretare male alcune situazioni umane ma spesso coglie segnali ignorati dagli altri.

ACE early: linea Zorua → Zoroark.

Reshiram appartiene a una futura storyline.

## FRIEND_BEAT_02

A2_FRIEND_NEWS viene espanso: non resta solo una notizia.

Almeno un amico deve poter interagire concretamente quando causalmente plausibile.

Esempi:

- Mattew nel Rookie Invitational;
- Daniel segue anomalie;
- Edward partecipa a una pattuglia;
- Fab aiuta fauna ferita;
- Luke NPC accetta un incarico.

Fight possibile nel Rookie Invitational o tramite sparring.

## Uscita

- Rank D possibile;
- N persistente;
- poaching network risolta/parziale/ignorata;
- conseguenze Ranger persistenti.

---

# 9. MODULO 3 — FERRO, POLVERE E PRESSIONE

**Livelli:** 5–9  
**Rank:** D→C  
**Area:** Cava Grigia → Ferravia → Gallerie Ferrox  
**NPC-Ancora:** Steven Stone  
**Tema:** “Una struttura sicura regge finché qualcuno non decide che il tempo vale più della sicurezza.”  
**Difficoltà Friend Beat:** MEDIO

## Funzione

Introdurre Asteria industriale, lavoro, sicurezza e incidenti reali.

## Conflitto

Vecchie mappe incomplete, nuova escavazione, cavità naturale e segnali sottovalutati creano una situazione instabile.

Non è necessario sabotaggio.

## Steven

Tecnico, paziente, osservatore.

ACE di lungo periodo: Beldum → Metang → Metagross.

Registeel arriva solo tramite futura storyline appropriata.

## FRIEND_BEAT_03

Anchor canonico:

**A3_FRIEND_CALL — One of the Five Calls**

L'amico può:

- chiedere aiuto;
- raggiungere Ferravia;
- collaborare a un lavoro;
- entrare nella Regional Cup;
- sfidare il player.

Il sistema sceglie chi ha la migliore intersezione con lo stato reale.

## Uscita

- Rank C possibile;
- Ferrox rescue risolto realmente;
- Regional Cup con risultato emergente;
- Steven persistente.

---

# 10. MODULO 4 — SALE, VENTO E MAREA

**Livelli:** 8–12  
**Rank:** C→B  
**Area:** Mareasale → Costa di Sale → Barriera Azzurra  
**NPC-Ancora:** Archie  
**Tema:** “Quando il mare cambia, puoi resistergli oppure imparare a muoverti con lui.”  
**Difficoltà Friend Beat:** MEDIO

## Funzione

Aprire il mondo marittimo e il circuito upper-regional.

## Conflitto

Meteo instabile, logistica, porto, piccola rete di contrabbando commerciale e pressione sulle rotte.

Non è una replica della rete di bracconaggio.

## Archie

Impulsivo, carismatico, ocean-first, fortissimo nel momentum.

ACE: Carvanha → Sharpedo → Mega Sharpedo.

Kyogre è soltanto un seed lontano.

## FRIEND_BEAT_04 — Friend on the Tide

Un amico deve intersecare il modulo:

- Coppa del Molo;
- traghetto;
- lavoro portuale;
- missione costiera;
- ricerca;
- incontro pianificato;
- contatto a distanza se nessun viaggio è causalmente possibile.

Fight possibile ma non obbligatorio.

## Uscita

- Rank B possibile;
- Upper Regional Circuit;
- Archie persistente;
- seed Kyogre possibile;
- contrabbando risolto/parziale/ignorato.

---

# 11. MODULO 5 — SOPRA LE NUVOLE

**Livelli:** 11–15  
**Rank:** B→A  
**Area:** Monti Ferrox → Altacima → Altopiano Fulgore  
**NPC-Ancora:** Lance  
**Tema:** “Salire non significa soltanto diventare più forti. Significa capire quanto rischio puoi permetterti.”  
**Difficoltà Friend Beat:** DIFFICILE

## Funzione

Completare la fascia regionale alta e aprire la carriera interregionale.

## Conflitto

Quota, freddo, vento, finestre meteo e priorità differenti.

Il rischio è naturale; gli esseri umani decidono come affrontarlo.

## Lance

Aggressivo ma disciplinato.

ACE: Dratini → Dragonair → Dragonite.

Giratina-Origin è molto più avanti.

## FRIEND_BEAT_05

Anchor canonico:

**A5_FIVE_CROSS — Five Roads Cross Again**

Prima grande reunion.

Compaiono tutti gli amici che causalità e schedule permettono.

Almeno uno è obbligatorio.

Possibili fight:

- Cordata;
- Staffetta del Temporale;
- sparring;
- evento competitivo.

## Mistero

Fulgore introduce una prima anomalia antica/meteorologica senza risolverla.

## Uscita

- Rank A possibile;
- licenza interregionale;
- Masters disponibile;
- Lance persistente;
- mistero antico seminato.

---

# 12. MODULO 6 — OLTRE I CONFINI

**Livelli:** 14–18  
**Rank:** A→S  
**Struttura:** circuito interregionale → Masters → Continental Cup → Primo Faro  
**NPC-Ancora:** Red  
**Tema:** “Essere forte nella propria regione e riuscire a esserlo ovunque sono due cose diverse.”  
**Difficoltà Friend Beat:** DIFFICILE

## Funzione

Trasformare il protagonista in competitor internazionale.

## Contenuto

Possibili tratte:

- Solaria;
- Luminara;
- Masters Circuit;
- Continental Cup;
- ritorno al Primo Faro;
- Trial A→S;
- World Ranking Cutoff.

Non è necessario visitare ogni destinazione.

## Red

Silenzioso, osservatore, adattivo.

ACE: Charmander → Charmeleon → Charizard.

Deoxys-Speed arriva soltanto attraverso futura storia appropriata.

## FRIEND_BEAT_06

A6_HIDDEN_TRAJECTORIES deve avere almeno un payoff visibile.

Un amico può:

- combattere nello stesso evento;
- mostrare una nuova evoluzione;
- incontrare il player;
- chiamarlo dopo un risultato;
- comparire nella Continental Cup;
- rivelare un cambio importante di carriera.

Fight possibile solo quando l'evento lo permette.

## Uscita

- Gate del Faro A→S;
- Rank S possibile;
- Red persistente;
- World cutoff in avvicinamento;
- secondo layer del mistero antico.

---

# 13. MODULO 7 — SOTTO I RIFLETTORI

**Livelli:** 17–20  
**Rank:** S  
**Area:** Meridiana  
**NPC-Ancora:** Cynthia  
**Tema:** “Arrivare fra i migliori significa anche imparare a vivere quando tutti ti stanno guardando.”  
**Difficoltà Friend Beat:** DIFFICILE→DIFFICILISSIMO

## Funzione

Professionalizzazione completa e qualificazione mondiale.

## Meridiana

Solo Rank S.

Funzioni:

- Grand Hall;
- Lega;
- media;
- sponsor;
- università;
- grande arena;
- stazione internazionale;
- medicina sportiva.

## Cynthia

Calma, gestione del lungo periodo, protezione delle risorse decisive.

ACE: Gible → Gabite → Garchomp.

## Contenuto

- sponsor;
- media;
- Masters scrim;
- World Ranking Cutoff;
- World Qualifier;
- Last Chance finito;
- Before the Lights.

Rank S non significa qualificazione.

## FRIEND_BEAT_07

Almeno un amico deve intersecare personalmente la corsa al Mondiale:

- stesso Qualifier;
- Last Chance;
- scrim;
- preparazione;
- amico già qualificato;
- amico eliminato.

Player vs Friend avviene solo se bracket reale.

## Uscita

- world_qualified true/false;
- Cynthia persistente;
- eventuale Last Chance risolto;
- Mondiale imminente o mancato.

---

# 14. MODULO 8 — IL MONDO NELLO STESSO POSTO

**Livelli:** 18–20  
**Fase:** Pre-World  
**NPC-Ancora:** Astrid Vahl  
**Tema:** “Hai passato tutta la carriera cercando di arrivare qui. Adesso scopri che anche gli altri hanno fatto lo stesso.”  
**Difficoltà Friend Beat:** DIFFICILISSIMO se fight

## Funzione

Far diventare il Mondiale un luogo reale prima del primo match.

## Contenuto

- arrivo;
- accrediti;
- controllo medico;
- registrazione;
- villaggio partecipanti;
- training hall;
- media;
- cerimonia;
- field dei 32;
- WORLD_DRAW.

I 32 derivano dallo stato reale.

Gli amici non vengono forzati nel field.

## Astrid

Campionessa del Mondo in carica.

Non è il final boss garantito.

## FRIEND_BEAT_08

Almeno un amico deve avere una scena personale.

Se qualificato:

- Village;
- training;
- pasto;
- discussione;
- sparring possibile.

Se non qualificato:

- spettatore;
- messaggio;
- telefonata;
- saluto.

## Uscita

- field 32 locked;
- gruppi generati;
- tre avversari del player noti;
- nessun match ancora giocato.

---

# 15. MODULO 9 — TRE PARTITE PER RESTARE

**Livelli:** 18–20  
**Fase:** World Group Stage  
**NPC-Faro:** Kaia Solari  
**Tema:** “Al Mondiale non devi vincere tutto subito. Devi sopravvivere abbastanza da poter continuare.”  
**Difficoltà Friend Beat:** DIFFICILISSIMO

## Funzione

Tre partite di gruppo.

Top 2 avanzano.

## Regole

- 3 match programmati;
- tutti gli altri gruppi vengono risolti;
- infortuni e forfait possono contare;
- niente risultato scriptato;
- niente tiebreak inventato nel layer narrativo: usa quello del sistema competitivo.

## Kaia

Rappresenta adattamento feroce e capacità di cambiare piano.

Non viene forzata nel gruppo del player.

## FRIEND_BEAT_09

Se un amico è nello stesso gruppo:

match ufficiale se il calendario lo prevede.

Se è in altro gruppo:

interazione tra giornate.

Se nessun amico si è qualificato:

contatto esterno.

Gli amici giocano al massimo delle proprie capacità.

## Uscita

- world_group_final_position;
- world_group_advanced true/false;
- Top 16 reali;
- eventuali amici/Anchor già eliminati.

---

# 16. MODULO 10 — NESSUNA SECONDA POSSIBILITÀ

**Livelli:** 18–20  
**Fase:** Round of 16 + Quarterfinal  
**NPC-Faro:** Silas Crowe  
**Tema:** “Da qui non importa più quanto bene hai giocato ieri.”  
**Difficoltà Friend Beat:** DIFFICILISSIMO

## Funzione

Prima metà della fase a eliminazione diretta.

## Regole

R16:

- single elimination;
- actual bracket only.

QF:

- single elimination;
- actual bracket only.

Nessun avversario sostituito per fanservice.

## Silas

Pressione altissima, mind games, punisce i turni passivi.

Non è boss obbligatorio.

## FRIEND_BEAT_10

Se un amico è ancora nel bracket:

la sua corsa è visibile.

Se il bracket produce Player vs Friend:

il match è obbligatorio e reale.

Se non si affrontano:

- risultato;
- supporto;
- tensione;
- eliminazione;
- relazione.

Se gli amici sono tutti fuori:

almeno uno mantiene un contatto personale.

## Uscita

Player può essere:

- eliminato agli ottavi;
- Top 8;
- Final Four.

---

# 17. MODULO 11 — PER DIVENTARE CAMPIONE

**Livelli:** 18–20  
**Fase:** Semifinale + Finale  
**NPC-Faro:** Rei  
**Tema:** “Non devi più dimostrare di appartenere a questo livello. Devi vincere le ultime due partite.”  
**Difficoltà Friend Beat:** DIFFICILISSIMO

## Funzione

Climax competitivo.

## Rei

Ex Campione del Mondo.

Pragmatico, adattivo, considera il caos una risorsa.

ACE: Samurott-Hisui.

Non è finalista garantito.

## Semifinale

WORLD_SF:

- single elimination;
- avversario reale;
- stato del team persistente;
- nessun heal narrativo.

## Finale

WORLD_FINAL:

**Champion is whoever actually wins.**

Nessun boss segreto dopo.

Nessun reroll per dramma.

## FRIEND_BEAT_11

Se un amico è Final Four:

la sua corsa continua realmente.

Se è avversario:

fight vero.

Se è nell'altra semifinale:

la simulazione decide.

Se nessuno è ancora nel torneo:

ultimo contatto personale pre-match quando plausibile.

## Uscita

- world_finalist;
- world_champion;
- current_world_champion = actual winner.

---

# 18. MODULO 12 — DOPO IL MONDO

**Livelli:** 18–20  
**Fase:** WORLD_EXIT / postgame  
**NPC-Ancora:** cast completo  
**Tema:** “Il torneo finisce. La tua vita no.”  
**Difficoltà Friend Beat:** chiusura relazionale; rematch opzionale DIFFICILISSIMO

## Funzione

Mostrare le conseguenze.

Non aggiungere una nuova escalation obbligatoria.

WORLD_EXIT deve funzionare per:

- world_champion;
- world_eliminated;
- worlds_missed.

## Ritorno ad Asteria

Callback dinamici a:

- Valedarsena;
- Bruma/Salice/Mirto;
- Ferravia/Ferrox;
- Mareasale;
- Altacima/Fulgore;
- circuito interregionale;
- Meridiana.

Le quest ignorate non aspettano congelate.

Gli NPC possono averle risolte, peggiorate o trasformate.

## FRIEND_BEAT_12

Idealmente chiusura con tutti gli amici disponibili.

Almeno uno garantito.

Possibili:

- cena;
- viaggio;
- discussione;
- congratulazioni;
- tensione;
- nuova separazione;
- obiettivi futuri;
- rematch.

Un rematch postgame usa lo stato reale e non è il nuovo final boss.

## Postgame

- free roam;
- side quest rimaste;
- esplorazione;
- relazioni;
- Legendary arcs;
- mistero antico;
- Primo Faro;
- eventuale ruolo maggiore di Rurik Dune;
- future stagioni.

## Uscita

MAIN_STORY_COMPLETE.

Il salvataggio resta giocabile.

---

# 19. IDENTITÀ DEI CINQUE COME AVVERSARI

Gli amici devono rimanere distinti.

## Luke NPC

Adaptive bulky pressure / logoramento.

Pericoloso perché cambia piano e trasforma chip/status in vantaggio.

## Mattew NPC

Tecnico, metodico, disciplinato.

Diventa molto più difficile quando dispone di informazioni e pattern.

## Daniel NPC

Pianificazione, trappole e letture.

Conoscere il player lo rende più pericoloso, non onnisciente.

## Edward NPC

Diretto, aggressivo, resistente.

Early game più leggibile; late game converte rapidamente vantaggi in danno.

## Fab NPC

Paziente, controllo, chip/status.

Late game difficile da smontare e capace di trasformare vantaggi lenti in chiusura.

---

# 20. ENDPOINT MONDIALI DEGLI NPC-ANCORA

Questi endpoint sono destinazioni di lungo periodo, non team anticipati.

- Blue — Mega Blastoise / Machamp / Zapdos / Tyranitar / Alakazam / Arcanine
- N — Reshiram / Zoroark / Galvantula / Ferrothorn / Mega Excadrill / Mienshao
- Steven — Mega Metagross / Registeel / Archaludon / Garganacl / Skarmory / Excadrill
- Archie — Kyogre / Mega Sharpedo / Archaludon / Ferrothorn / Pelipper / Basculegion-M
- Lance — Dragonite / Mega Salamence / Garchomp / Dragapult / Archaludon / Giratina-Origin
- Red — Gmax Charizard / Jolteon / Lapras / Dodrio / Deoxys-Speed / Mega Scizor
- Cynthia — Garchomp / Mega Lucario / Milotic / Togekiss / Cresselia / Roserade
- Astrid — Xerneas / Mega Mawile / Corviknight / Rotom-W / Dragapult / Clodsire
- Kaia — Koraidon / Mega Houndoom / Flutter Mane / Walking Wake / Great Tusk / Corviknight
- Silas — Calyrex-Shadow / Ceruledge / Grimmsnarl / Baxcalibur / Glimmora / Mega Gengar
- Rei — Samurott-Hisui / Zoroark-Hisui / Ursaluna / Mega Scizor / Sneasler / Palkia-Origin

Le pre-evoluzioni vengono usate solo quando legalmente esistono.

I Legendary arrivano attraverso lore vera e non sono consegnati in anticipo.

---

# 21. AUDIT FINALE

## Rank progression

**PASS**

F→E→D→C→B→A→S→Qualifier→World.

## Level bands

**PASS DOPO CORREZIONE**

Le bande sono allineate al MAIN_EVENT_GRAPH.

## Geography

**PASS**

Gli accessi seguono Rank, viaggio e world state.

## Meridiana

**PASS**

Rank S.

## Faro

**PASS**

Gate A→S.

## World Qualifier

**PASS**

Separato dal Rank S.

## Mondiale

**PASS**

32 → gruppi → 16 → 8 → 4 → 2 → Campione reale.

## Postgame

**PASS**

WORLD_EXIT.

Nessun ACT competitivo extra inventato.

## Five / friends

Prima dell'audit: **PARTIAL**.

Dopo questa convergenza: **DESIGN PASS**.

Ogni modulo contiene almeno un FRIEND_BEAT.

---

# 22. DEFINITION OF DONE PER MODULO

Un modulo non è completo finché non contiene:

1. area e timeline;
2. visible/living/conflict/secret/player-impact layer;
3. NPC-Ancora o funzione equivalente;
4. cast locale;
5. side quest;
6. main beats;
7. conseguenze se ignorato;
8. flag persistenti;
9. collegamento dal modulo precedente;
10. collegamento al modulo successivo;
11. almeno un FRIEND_BEAT;
12. difficoltà coerente col livello reale dell'amico;
13. nessun level scaling invisibile;
14. nessun dialogo/emozione imposta al player;
15. compatibilità con Pokémon 5e;
16. callback futuri.

---

# 23. STATO MASTER

- **12/12 moduli convergenti**
- **Rank progression: LOCKED**
- **Level bands: LOCKED**
- **NPC-Ancora: LOCKED**
- **Friend system: LOCKED**
- **World structure: LOCKED**
- **Postgame structure: LOCKED**
- **Pronto per conversione tecnica in scene/event graph senza modificare il design canonico**

---

# 24. REGOLA CANONICA FINALE DEI FIVE

> Nessun modulo del Librogame5e può essere considerato completo se non contiene almeno un'interazione significativa con uno degli altri quattro membri dei Five.

> La difficoltà dei loro confronti cresce organicamente da Facile → Medio → Difficile → Difficilissimo usando esclusivamente livello, roster, evoluzioni, ferite, equipaggiamento, esperienza e stato reale del personaggio.

> Essere amici non altera l'AI competitiva. Se il bracket mondiale produce Player vs Friend, entrambi combattono per vincere.

---

**Fine — P5E LIBROGAME 12 MODULES MASTER**
