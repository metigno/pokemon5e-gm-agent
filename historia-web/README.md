# Pokémon Historia Web — MVP tecnico

Avvio: `cd historia-web && npm start` (Node 20+), poi aprire http://localhost:3000. Per la chat impostare `OPENAI_API_KEY` come variabile d'ambiente server; opzionale `OPENAI_MODEL`. Non inserire la chiave nel browser o nel repository.

Disponibile: UI mobile chat/arena, scelta modalità per incontro (solo UI), apertura sito Showdown, importazione manuale log, parsing eventi, chat AI opzionale. La cronologia chat è solo in RAM, non persistente.

**Non disponibile:** battaglie Showdown incorporate, controllo Luke via AI, autenticazione, salvataggi persistenti, import replay da URL, sincronizzazione automatica dei risultati, lore completa dal repository e tornei gestiti automaticamente. Non dichiarare il prototipo come gioco completo.

Passi successivi: test automatici, persistenza DB, caricamento canon, motore Showdown self-hosted, controller AI e interfaccia interattiva, test end-to-end. Evitare merge finché CI non è green.
