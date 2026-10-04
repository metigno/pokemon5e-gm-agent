# WORLD STATE SCHEMA

Ogni slot contiene `world-state.json`.

È separato da `campaign.json`:

- `campaign.json` = player, party, progressione, combattimento, relazioni e catene principali;
- `world-state.json` = geografia persistente, tempo locale, location, lavori, economia, news, rumor, fazioni ed ecologia.

## Campi minimi

- world_id
- current_location_id
- clock
- discovered_locations
- visited_locations
- location_states
- economy
- jobs
- news
- rumors
- faction_clocks
- ecology
- transit
- persistent_changes

## Regola

Non duplicare dati senza motivo.

Se una ricompensa o oggetto appartiene al player, resta in `campaign.json`.

Se uno shop è chiuso, una strada è bloccata o una zona è stata modificata, resta in `world-state.json`.
