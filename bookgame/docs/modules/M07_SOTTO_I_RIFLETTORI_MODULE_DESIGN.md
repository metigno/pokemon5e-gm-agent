# P5E LIBROGAME — M07 MODULE DESIGN

**Modulo:** M7 — Sotto i Riflettori  
**Stato:** MASTER-MAPPED / IMPLEMENTATION-READY DESIGN  
**Progetto:** Pokémon 5e Digital Librogame / Librogame5e  
**Branch:** pokemon5e-digital-bookgame  
**Trainer level band:** 17–20  
**Fase:** Rank S / World Qualifier  
**Area primaria:** Meridiana  
**NPC-Ancora:** Cynthia  
**FRIEND_BEAT_07:** obbligatorio, difficoltà DIFFICILE → DIFFICILISSIMO

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
8. `M07_PRODUCTION_MAPPING.md`

M7 riusa E1–E7 già costruiti per M1. Nessun nuovo sottosistema va creato se Conditions, Time, Quest State, NPC/Relationships, Competition, Living World o Ecology possono già esprimere il requisito.

Entry contract:
- `m6_complete=true`;
- `current_rank=S`;

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

Professionalizzare completamente la carriera e risolvere la qualificazione al Mondiale senza confondere Rank S con world_qualified.

Tema:

**“Arrivare fra i migliori significa anche imparare a vivere quando tutti ti stanno guardando.”**

Il modulo deve essere giocabile come parte di un mondo semi-aperto: l'evento principale orienta la pressione, ma non congela esplorazione, side quest, allenamento, catture, servizi, recupero o schedule NPC.

---

# 2. LAYER DEL MODULO

## 2.1 Visible layer

Il player vede Meridiana, servizi coerenti con la fascia, fauna contestuale, trainer del circuito, almeno un'interazione significativa con un amico e l'Anchor Cynthia quando causalmente plausibile.

## 2.2 Living layer

Mentre il player decide:

- gli altri Four viaggiano e ottengono risultati;
- competizioni non-player vengono risolte;
- quest e problemi possono scadere, peggiorare o essere risolti da NPC;
- fauna, servizi e schedule reagiscono a tempo e world state;
- gli Anchor seguono traiettorie proprie;
- nessun evento resta congelato solo perché non è sullo schermo.

## 2.3 Conflict layer

Media, sponsor, medicina sportiva, preparazione e bracket del Qualifier comprimono tempo e attenzione; la qualificazione deve emergere dal risultato reale.

## 2.4 Continuity layer

M7 deve leggere callback di tutti i moduli precedenti quando rilevanti, senza richiedere che il player abbia visto ogni contenuto opzionale. Un callback può cambiare dialogo, reputazione, disponibilità, informazione, prezzo, rischio, schedule o accesso; non deve attribuire ricompense mai guadagnate.

## 2.5 Player-impact layer

Le scelte devono modificare almeno uno fra route, informazione, tempo, rischio, relazione, quest/world state, combat/encounter state o accesso futuro. Le false choice che collassano senza differenza non contano nel budget.

---

# 3. NPC-ANCORA — Cynthia

Traiettoria/Ace: **Gible → Gabite → Garchomp**.

L'Anchor:

- usa un roster stage-aware coerente con livello e carriera;
- può vincere o perdere quando combatte;
- non sostituisce il gate Rank;
- non è automaticamente villain o boss;
- conserva relazione, schedule, risultati e stato di carriera;
- può creare callback futuri fino al Mondiale/postgame.

---

# 4. FRIEND_BEAT_07

Difficoltà: **DIFFICILE → DIFFICILISSIMO**.

Il selector valuta disponibilità, posizione, schedule, relazione, uso recente, eventi irrisolti, livello/stato competitivo e compatibilità con il modulo.

Un contatto remoto è valido solo quando l'incontro fisico non è causalmente plausibile. Un fight avviene soltanto se la scena o il bracket lo rendono legale e usa sempre il roster reale dell'amico.

Writes minimi:

- `friend_beat_07_complete`;
- `friend_beat_07_friend_id`;
- `friend_beat_07_type`;
- eventuale result/context persistente.

---

# 5. COMPETIZIONE E EVENT BINDING

Eventi canonici consumati dal modulo:

- `A7_WORLD_QUALIFIER`
- `A7_LAST_CHANCE`
- `A7_BEFORE_LIGHTS`

Nessun documento di contenuto può cambiare trigger, checkpoint o formato canonico senza aggiornare prima la Source of Truth tecnica competente.

---

# 6. STATE OWNERSHIP

M7 possiede soltanto lo stato narrativo/competitivo nuovo introdotto qui. Tutto ciò che è già strutturato nel motore resta di proprietà del relativo subsystem.

State families del modulo:

- `m7_complete`;
- stato Anchor Cynthia;
- `friend_beat_07_*`;
- outcome dei conflitti/competizioni specifici di M7;
- unlock del modulo successivo quando l'exit contract è soddisfatto.

Non duplicare roster, HP, PP, inventario, denaro, Trainer level, Pokémon level, EXP, status, injury o schedule in flag narrativi.

---

# 7. EXIT CONTRACT

M7 è formalmente chiuso per una run quando:

- `cynthia_met=true`;
- `friend_beat_07_complete=true`;
- `world_qualified=true oppure worlds_missed=true`;
- `qualifier_history persistente`;
- `m08_unlocked solo se world_qualified`;
- `m12_unlocked se worlds_missed`;

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
