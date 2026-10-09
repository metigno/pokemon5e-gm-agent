# Pokémon GPT Historia Web — Showdown integration (technical alpha)

Independent app under `historia-web/`. **Does not modify Pokémon 5e Digital Bookgame, bookgame saves, or `bookgame-canonical`.** The lore is canonical through 2056, next World Cup is 2060 (every four years). Historical 2056 ranking data is exposed read-only; it is *not* proof of 2060 qualification.

## Start

Requires Node.js 22+ and network connectivity for the initial dependency installation:

```bash
cd historia-web
npm install --no-audit --no-fund
npm test
npm start
```

Open http://localhost:3000 and select **Arena > Avvia allenamento tecnico 6v6**. Choose **manuale** to send Luke's real move/switch decisions or **automatica** to watch the bots. Alternatively supply *two* Showdown packed-format teams with six Pokémon each. The terminal winner and battle events come only from the installed official `pokemon-showdown` package, using its self-hosted `BattleStream` simulator and split player/spectator streams.

Environment:
- `PORT`: HTTP listener, default 3000.
- `HISTORIA_DATA_DIR`: server-local persistence directory, default `historia-web/.data/` (should be on a persistent volume). It contains **only Historia** files; never mount a Pokémon 5e save directory.
- `OPENAI_API_KEY`: optional server-only key for the narrative Master AI. `OPENAI_MODEL` defaults to `gpt-4.1-mini`.

`GET /api/status`, `GET /api/competition`, `GET /api/battles`, `GET /api/battles/:id`, `POST /api/battles` and `POST /api/battles/:id/choice` form the local API. `GET/POST /api/chat` support the optional Master. The browser polls the authenticated *player request* through the local API and displays only public spectator events. A replay after completion is saved to `.data/battles/` and can be opened from **Replay** by the owning session. A browser-generated 40-character hexadecimal session secret is sent in the `X-Historia-Session` HTTP header for private chat, replay, match and choice APIs; never put this secret into URL query strings. Cross-device restoration uses the same secret. This is **capability-based experimental access**, not a production login system: anyone obtaining the secret can use that session. Manual external replay imports (`POST /api/replay`) are always marked unverified and **cannot** register a victory.

## Verification and scope

`npm test` includes protocol unit tests, an upstream Showdown integration test and 6v6 manual/automatic end-to-end tests which verify authentic `|win|` events and persistence. See `.github/workflows/historia-web.yml` for the dedicated CI. Do not treat source-code presence as proof that a real battle has been tested successfully; check the corresponding workflow run.

**Implemented / partial:** manual control, bot vs bot spectator mode, real 6v6 simulator, public log, basic replay and filesystem persistence, optional chat, historical ranking read-only, responsive single-page arena. Bots currently select a simple legal action from only their own request; **they are not competitive tactical NPCs**. External animated Showdown sprites require Internet access.

**Not yet complete / not official:** a validated Historia custom format allowing all canon species/forms and the exact Mega + Dynamax policy, a verified canonical major-legendary species registry, a full multiplayer spectator/fog-of-war audit, player authentication, trustworthy 2060 roster and qualifiers, canonical fixtures/standings/knockout integration, deployment, reliable mid-battle restoration across server restarts, replay playback controls, autonomous personality-driven AI, and full mobile/browser E2E tests. `gen8customgame` is a **technical development format**, not the certified Lega GPT ruleset. Practice matches must never update World Cup standings.

A public deploy must add login/access controls, CSRF/origin protection, request and concurrency rate limits, dependency pinning, telemetry, and volume backups before it handles real players. The app is currently suited to trusted/private development only.

## Canonical merge

The branch `historia-web-showdown-integration` incorporated the independent historical `historia/src/battle-session.mjs`, `save.mjs`, `showdown-bridge.mjs` and `storage.mjs` plus tests in a two-parent Git merge commit without altering existing Bookgame code. The official `historia/src/showdown-bridge.mjs` validates terminal log receipts; tournament standings are deliberately left read-only until verified 2060 entrants and matching fixtures are available.


## Phase 3 verified evidence (2026-10-09)
- An authentic simulator match Mega Evolves Venusaur then Dynamaxes **another Pokémon**, Arcanine, and reaches a Showdown-authored winner. This is an integration test, not mocked combat.
- The current official Showdown Dex and actual battle choice requests disallow Dynamax for Zacian, Zacian-Crowned, Zamazenta, Zamazenta-Crowned, and Eternatus. The browser protocol adapter independently excludes those moves.
- Server-side team vetting rejects Z-Crystals, Z/Max moves in sets, Gigantamax flags, Terastallization, nonstandard IV/EV ceilings, repeated items, non-six teams and levels other than 100. An Alpha nickname does not alter base stats.
- Match ownership is enforced before server returns a *private* Luke request, accepts a move or lists saved results. The public battle log is sourced only from Showdown's spectator stream; tests assert no `|request|`, `|split|` or `|error|` packets are persisted there.
- **No official fixture begins yet**: `official:true` is rejected by the BattleService, until confirmed 2060 entrants/teams and a canonical major-legendary registry exist. A list supplied by a client must **never** be interpreted as authoritative canonical rules.
- `gen8customgame` is still a development-only format. Showdown Gen8 cannot automatically certify every newer regional form or all custom League GPT constraints. No CI success on this test fixture should be read as proof of a complete 2060 format.
