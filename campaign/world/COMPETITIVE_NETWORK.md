# CIRCUITO COMPETITIVO DI ASTERIA

## Sistema ufficiale

Asteria non usa medaglie come chiave di progressione.

Il sistema è il **Circuit Rank**:

**F → E → D → C → B → A → S**

Ogni avanzamento richiede una Promotion Trial ufficiale. Sono sfide con importanza simile alle Palestre classiche, ma promuovono direttamente il rank della Trainer License.

## Hard area gate

Il player può esplorare liberamente la fascia già autorizzata, ma **la fascia successiva resta inaccessibile finché non vince la Promotion Trial precedente**.

Né livelli, né side quest, né denaro, né circuit points sostituiscono una Promotion Trial.

## Promotion Trial

1. Valedarsena — Arena Civica: **F → E**
2. Borgo Salice — Sala Verde: **E → D**
3. Ferravia — Officina Arena: **D → C**
4. Mareasale — Arena del Molo: **C → B**
5. Altacima — Sala della Cresta: **B → A**
6. Rovine del Primo Faro — Gate del Faro: **A → S**

Dopo Rank S:
7. Meridiana — Grand Hall: **World Qualifier**

Il World Qualifier non assegna un nuovo rank: produce o meno `world_qualified`.

## Sconfitte

Una Promotion Trial persa:
- non retrocede il trainer;
- non sblocca la fascia successiva;
- resta ritentabile dopo recupero/preparazione;
- viene registrata nella storia competitiva.

Il World Qualifier segue invece il calendario stagionale e le eventuali Last Chance reali.

## Circuit Points

I punti servono a seeding, inviti, ranking, reputazione e tiebreak.

Non sbloccano aree e non comprano promozioni.

## Tornei

Rookie Cup, Upper Regional Circuit, Masters, Continental Cup e altri eventi possono dare punti, fama e premi, ma non sostituiscono la scala F→S.

## NPC

Gli NPC persistenti hanno un proprio rank e possono superare, fallire o ritentare le loro Promotion Trial indipendentemente dal protagonista.

Vedi `RANK_PROGRESSION_SYSTEM.md` e `RANK_CHECKPOINTS.json`.
