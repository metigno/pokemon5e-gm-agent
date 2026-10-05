# P5E LIBROGAME — M03 MODULE DESIGN

**Modulo:** M3 — Ferro, Polvere e Pressione  
**Stato:** MASTER-MAPPED / IMPLEMENTATION-READY DESIGN  
**Progetto:** Pokémon 5e Digital Librogame / Librogame5e  
**Branch:** pokemon5e-digital-bookgame  
**Trainer level band:** 5–9  
**Fase:** Rank D → C  
**Area primaria:** Cava Grigia → Ferravia → Gallerie Ferrox  
**NPC-Ancora:** Steven Stone  
**FRIEND_BEAT_03:** obbligatorio, difficoltà MEDIO

---

# 0. AUTORITÀ E VINCOLI

Ordine di autorità:

1. `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`
2. `P5E_LIBROGAME_12_MODULES_MASTER.md`
3. `campaign/events/MAIN_EVENT_GRAPH.json`
4. `campaign/world/RANK_CHECKPOINTS.json`
5. `campaign/events/ROSTER_STAGE_POLICY.json`
6. dati/regole Pokémon 5e locali
7. questo documento
8. `M03_PRODUCTION_MAPPING.md`

M3 riusa E1–E7 già costruiti per M1. Nessun nuovo sottosistema va creato se Conditions, Time, Quest State, NPC/Relationships, Competition, Living World o Ecology possono già esprimere il requisito.

Entry contract:
- `m2_complete=true`;
- `current_rank=D`;

Vincoli invarianti:

- nessun level scaling invisibile;
- niente Fakémon;
- nessun risultato di battaglia predeterminato;
- niente teletrasporto degli NPC per ottenere una scena;
- HP, PP, condizioni, inventario, denaro, roster, EXP, evoluzioni e infortuni non si resettano tra moduli;
- gli eventi competitivi usano E5 e i checkpoint canonici, mai flag narrativi paralleli;
- il mondo e gli altri trainer continuano anche se il player rinvia o ignora una trama;
- FRIEND_BEAT usa lo stato reale di uno dei Four;
- Anchor e amici non ricevono plot armor sui risultati competitivi.

---

# 1. FUNZIONE DEL MODULO

Introdurre Asteria industriale, i compromessi tra produttività e sicurezza e il primo rescue a scala regionale.

Tema:

**“Una struttura sicura regge finché qualcuno non decide che il tempo vale più della sicurezza.”**

Il modulo deve essere giocabile come parte di un mondo semi-aperto: l'evento principale orienta la pressione, ma non congela esplorazione, side quest, allenamento, catture, servizi, recupero o schedule NPC.

---

# 2. LAYER DEL MODULO

## 2.1 Visible layer

Il player vede Cava Grigia → Ferravia → Gallerie Ferrox, servizi coerenti con la fascia, fauna contestuale, trainer del circuito, almeno un'interazione significativa con un amico e l'Anchor Steven Stone quando causalmente plausibile.

## 2.2 Living layer

Mentre il player decide:

- gli altri Four viaggiano e ottengono risultati;
- competizioni non-player vengono risolte;
- quest e problemi possono scadere, peggiorare o essere risolti da NPC;
- fauna, servizi e schedule reagiscono a tempo e world state;
- gli Anchor seguono traiettorie proprie;
- nessun evento resta congelato solo perché non è sullo schermo.

## 2.3 Conflict layer

Vecchie mappe incomplete, nuova escavazione, cavità naturali e segnali sottovalutati creano una situazione instabile. Il sabotaggio non è la spiegazione di default.

## 2.4 Continuity layer

M3 deve leggere callback di tutti i moduli precedenti quando rilevanti, senza richiedere che il player abbia visto ogni contenuto opzionale. Un callback può cambiare dialogo, reputazione, disponibilità, informazione, prezzo, rischio, schedule o accesso; non deve attribuire ricompense mai guadagnate.

## 2.5 Player-impact layer

Le scelte devono modificare almeno uno fra route, informazione, tempo, rischio, relazione, quest/world state, combat/encounter state o accesso futuro. Le false choice che collassano senza differenza non contano nel budget.

---

# 3. NPC-ANCORA — Steven Stone

Traiettoria/Ace: **Beldum → Metang → Metagross**.

L'Anchor:

- usa un roster stage-aware coerente con livello e carriera;
- può vincere o perdere quando combatte;
- non sostituisce il gate Rank;
- non è automaticamente villain o boss;
- conserva relazione, schedule, risultati e stato di carriera;
- può creare callback futuri fino al Mondiale/postgame.

---

# 4. FRIEND_BEAT_03

Difficoltà: **MEDIO**.

Il selector valuta disponibilità, posizione, schedule, relazione, uso recente, eventi irrisolti, livello/stato competitivo e compatibilità con il modulo.

Un contatto remoto è valido solo quando l'incontro fisico non è causalmente plausibile. Un fight avviene soltanto se la scena o il bracket lo rendono legale e usa sempre il roster reale dell'amico.

Writes minimi:

- `friend_beat_03_complete`;
- `friend_beat_03_friend_id`;
- `friend_beat_03_type`;
- eventuale result/context persistente.

---

# 5. COMPETIZIONE E EVENT BINDING

Eventi canonici consumati dal modulo:

- `A3_FRIEND_CALL`
- `A3_RANK_TRIAL_D_C`
- `A3_CROSSROADS`
- `A3_REGIONAL_CUP`

Nessun documento di contenuto può cambiare trigger, checkpoint o formato canonico senza aggiornare prima la Source of Truth tecnica competente.

---

# 6. STATE OWNERSHIP

M3 possiede soltanto lo stato narrativo/competitivo nuovo introdotto qui. Tutto ciò che è già strutturato nel motore resta di proprietà del relativo subsystem.

State families del modulo:

- `m3_complete`;
- stato Anchor Steven Stone;
- `friend_beat_03_*`;
- outcome dei conflitti/competizioni specifici di M3;
- unlock del modulo successivo quando l'exit contract è soddisfatto.

Non duplicare roster, HP, PP, inventario, denaro, Trainer level, Pokémon level, EXP, status, injury o schedule in flag narrativi.

---

# 7. EXIT CONTRACT

M3 è formalmente chiuso per una run quando:

- `current_rank=C`;
- `steven_met=true`;
- `friend_beat_03_complete=true`;
- `ferrox_rescue_state persistente`;
- `regional_cup_result registrato se disputato`;
- `m04_unlocked=true`;

Una sconfitta a un gate retryable non resetta il modulo. Una eliminazione World può invece cambiare il percorso e portare direttamente a WORLD_EXIT/M12 secondo lo stato reale.

---

# 8. PRODUCTION RULE

Il target di stitches/scelte è capacità autoriale complessiva, non contenuto che una singola run deve vedere.

Ogni blocco deve avere:

- reads/writes espliciti;
- condizioni data-driven;
- almeno un esito persistente quando la scelta è significativa;
- regressioni per save/reload e idempotenza;
- nessuna scorciatoia alle regole Pokémon 5e.
