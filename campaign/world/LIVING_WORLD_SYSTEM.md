# LIVING WORLD SYSTEM — ASTERIA

## Obiettivo

Il mondo deve sembrare vivo senza richiedere una simulazione infinita.

Il GM aggiorna ciò che può cambiare davvero la partita:
- player;
- quattro amici;
- NPC persistenti già introdotti;
- location visitate o vicine;
- job aperti;
- fazioni attive;
- competizioni;
- catene in corso;
- ecologia rilevante;
- eventi del mondo.

Il resto usa **lazy simulation**: viene aggiornato quando torna rilevante.

## Tempo

Il tempo di Asteria è campagna, non tempo reale del telefono.

Fasi consigliate:
- alba 05:00–08:00;
- mattina 08:00–12:00;
- pomeriggio 12:00–17:00;
- sera 17:00–21:00;
- notte 21:00–01:00;
- notte fonda 01:00–05:00.

Il GM può usare minuti esatti quando viaggio, turni o scadenze lo richiedono.

### World Pulse

Eseguire un world pulse quando:
- passano circa 2+ ore;
- cambia fase del giorno;
- avviene un long rest;
- il player viaggia fra macro-zone;
- termina un evento importante;
- arriva una deadline.

Un pulse può aggiornare:
- posizioni NPC;
- apertura/chiusura attività;
- job board;
- news;
- meteo;
- incontri disponibili;
- trasporti;
- faction clock;
- off-screen friend actions.

## Lazy simulation

Ogni location/NPC persistente registra `last_updated_day/time`.

Quando torna rilevante:
1. calcolare il tempo trascorso;
2. avanzare solo i clock che avevano una causa;
3. risolvere eventuali scadenze;
4. aggiornare posizione/attività;
5. produrre soltanto conseguenze plausibili.

Non inventare dieci eventi perché il player è stato via due giorni.

## NPC Scheduler

Ogni NPC persistente può avere:
- home;
- role;
- current_location;
- current_activity;
- next_intent;
- schedule_tags;
- resources;
- relationships;
- open_chain;
- availability.

Esempio di schedule:
- negoziante: apre mattina, pausa breve, chiude sera;
- Ranger: pattuglia fuori città e rientra;
- trainer NPC: viaggio, allenamento, job, match, riposo;
- infermiera/medico: turni, ma il Centro mantiene copertura di servizio.

Gli NPC non sono immobili in attesa del player.

## Quattro amici

I quattro amici NPC vengono aggiornati a ogni world pulse importante.

Possibili attività:
- viaggio;
- allenamento;
- job;
- acquisto;
- cura;
- cattura plausibile;
- incontro con altro NPC;
- match;
- ricerca evolutiva dell'ACE;
- riposo;
- partecipazione a evento competitivo.

Le attività devono essere coerenti con:
- livello;
- denaro;
- posizione;
- carattere;
- obiettivi;
- requisiti reali Pokémon 5e.

Gli esiti rilevanti non sono predeterminati.

## Attività commerciali

Ogni attività ha:
- orari;
- stock;
- fascia prezzi;
- restock;
- eventuali scarsità;
- proprietario/staff;
- reputazione col player.

I prezzi non oscillano casualmente a ogni visita.

Modifiche plausibili derivano da:
- scarsità;
- evento locale;
- approvvigionamento;
- reputazione;
- mercato nero;
- torneo/festival;
- crisi.

Default consigliato per variazioni dinamiche ordinarie: entro circa ±20% dal prezzo locale di riferimento, salvo eventi eccezionali.

## Job Board

Ogni città importante mantiene una board.

Regole:
- 2–5 job visibili per refresh;
- lavori semplici scadono in 1–3 giorni;
- lavori urgenti possono sparire prima;
- NPC possono accettare lavori prima del player;
- lavori ignorati possono essere risolti da altri, fallire o peggiorare;
- le ricompense devono riflettere rischio, tempo e costo.

Un job non esiste per sempre solo perché è stato mostrato una volta.

## Ecologia

Ogni zona ha:
- habitat tags;
- specie comuni;
- specie non comuni;
- specie rare;
- attività per fase del giorno;
- pressione umana;
- eventuale disturbo/ecological stress.

Non usare sempre la stessa tabella.

Un warehouse urbano e un bosco notturno non generano gli stessi incontri.

Catture, incendi, lavori, clima o migrazioni possono cambiare temporaneamente la presenza di Pokémon.

## Meteo

Il meteo viene risolto per macro-zona quando diventa rilevante.

Non serve aggiornare l'intero continente ogni ora.

Il meteo può:
- modificare fiction/visibilità;
- cambiare tempi di viaggio;
- cambiare fauna attiva;
- influire sulle regole quando Pokémon 5e lo prevede.

## News

Le notizie derivano da fatti reali dello stato.

Categorie:
- risultati competitivi;
- incidenti;
- viabilità;
- Pokémon insoliti;
- eventi pubblici;
- amici/rivali;
- Lega;
- criminalità;
- ricerca.

Una news non deve rivelare informazioni private che il mondo non conoscerebbe.

## Rumors

Le voci possono essere:
- vere;
- parziali;
- obsolete;
- false.

Il GM registra in privato `truth_state` e `source_quality`.

Non trasformare ogni rumor in una quest vera.

## Faction Clocks

Una fazione/catena può usare clock 0–6.

Esempio:
- 0 inattiva;
- 1 preparazione;
- 2 primi effetti;
- 3 problema visibile;
- 4 escalation;
- 5 crisi;
- 6 conseguenza maggiore.

Il clock sale solo quando esiste una causa: tempo, risorse, successo NPC, fallimento player o world event.

## Economia narrativa

Denaro e oggetti restano meccanici.

Il mondo dà contesto:
- lavori;
- costi di viaggio;
- pernottamento;
- cure/servizi quando previsti;
- acquisti;
- premi;
- sponsor più avanti.

Non premiare il player automaticamente perché è protagonista.

## Persistenza locale

Quando il player modifica seriamente un luogo, registrare il fatto.

Esempi:
- warehouse ripulito;
- proprietario aiutato;
- finestra rotta;
- NPC ferito;
- Pokémon catturato;
- strada liberata;
- debito;
- reputazione.

Al ritorno, la scena deve rifletterlo.

## Limite di simulazione

Non simulare ogni abitante.

Priorità:
1. cast persistente;
2. area del player + nodi adiacenti;
3. catene attive;
4. eventi con deadline;
5. personaggi del Character Bible coinvolti;
6. resto del mondo tramite lazy simulation.

Questo produce profondità senza caos arbitrario.
