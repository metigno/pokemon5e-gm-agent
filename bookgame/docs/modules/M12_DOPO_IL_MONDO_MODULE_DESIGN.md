# P5E LIBROGAME — M12 MODULE DESIGN

**Modulo:** M12 — Dopo il Mondo  
**Stato:** MASTER-MAPPED / IMPLEMENTATION-READY DESIGN  
**Progetto:** Pokémon 5e Digital Librogame / Librogame5e  
**Branch:** pokemon5e-digital-bookgame  
**Trainer level band:** 18–20  
**Fase:** WORLD_EXIT / Postgame  
**Area primaria:** ritorno ad Asteria + mondo persistente  
**NPC-Ancora:** cast completo  
**FRIEND_BEAT_12:** obbligatorio, chiusura relazionale; rematch opzionale DIFFICILISSIMO

---

# 0. AUTORITÀ E ENTRY CONTRACT

Autorità: Engine Source of Truth → 12 Modules Master → MAIN_EVENT_GRAPH → World/Rank state → questo documento → M12 Production Mapping.

M12 entra quando almeno uno è vero:

- `world_champion=true`;
- `world_eliminated=true`;
- `worlds_missed=true`.

M12 non introduce ACT_9 competitivo e non crea un boss obbligatorio dopo il Mondiale.

---

# 1. FUNZIONE

Mostrare le conseguenze dell'intera campagna e restituire un salvataggio vivo, esplorabile e non resettato.

Tema:

**“Il torneo finisce. La tua vita no.”**

Il modulo deve funzionare allo stesso modo strutturale per campione, eliminato al Mondiale o trainer che il Mondiale lo ha mancato: cambiano contenuto e reputazione, non la dignità del percorso.

---

# 2. WORLD_EXIT

`WORLD_EXIT` è l'unico hard anchor finale.

Deve leggere:

- risultato competitivo reale;
- Rank e ranking;
- roster, livelli, EXP, injury e condizioni;
- Anchor incontrati;
- FRIEND_BEAT_01→11;
- quest completed/failed/ignored;
- world pressure e off-screen resolution;
- reputazioni locali;
- mistero antico e Legendary arcs realmente aperti.

Non può riscrivere il passato per produrre una conclusione più cinematografica.

---

# 3. RITORNO AD ASTERIA

Callback dinamici obbligatori, quando la run li ha resi rilevanti:

- Valedarsena / Ginestre / Fattoria;
- Bruma / Borgo Salice / Palude Mirto;
- Cava / Ferravia / Ferrox;
- Mareasale / Costa / Barriera;
- Altacima / Fulgore;
- circuito interregionale / Masters / Primo Faro;
- Meridiana.

Le quest ignorate non aspettano congelate: E6 determina se NPC le hanno risolte, se sono peggiorate o se si sono trasformate.

---

# 4. CAST COMPLETO

Gli Anchor possono ricomparire soltanto se posizione, schedule, stato competitivo e relazioni lo permettono.

Gli endpoint mondiali dei roster restano conseguenza della carriera, non ricompensa automatica.

Nessun Anchor o amico viene teletrasportato per una scena corale.

---

# 5. FRIEND_BEAT_12

Idealmente coinvolge tutti gli amici disponibili; almeno uno deve essere garantito tramite un contatto causalmente valido.

Forme possibili:

- cena;
- viaggio;
- confronto;
- congratulazioni;
- tensione;
- nuova separazione;
- progetti futuri;
- rematch.

Un rematch usa roster/stato reali e non diventa il nuovo final boss.

Writes minimi:

- `friend_beat_12_complete`;
- `friend_beat_12_friend_ids`;
- `friend_beat_12_type`;
- eventuali relationship/result callback.

---

# 6. POSTGAME

Dopo MAIN_STORY_COMPLETE restano legalmente giocabili:

- free roam;
- side quest residue;
- esplorazione;
- relazioni;
- allenamento/catture secondo mondo;
- Legendary arcs non concluse;
- mistero antico;
- Primo Faro;
- eventuali future stagioni.

Il postgame riusa E1–E7 e non crea un secondo save model.

---

# 7. EXIT CONTRACT

M12 è chiuso come main story quando:

- `WORLD_EXIT` è risolto;
- `friend_beat_12_complete=true`;
- `main_story_complete=true`;
- `postgame_free_roam=true`.

La chiusura non resetta né rende read-only il salvataggio.

---

# 8. NON-NEGOTIABLES

- nessuna nuova escalation obbligatoria;
- nessun epilogo che imponga emozioni/voce al player;
- nessun reset del mondo;
- nessuna resurrezione di quest finite solo per callback;
- nessun risultato World alterato;
- nessun contenuto postgame che retroattivamente cambi il campione;
- save/reload deve preservare MAIN_STORY_COMPLETE e tutto lo stato precedente.
