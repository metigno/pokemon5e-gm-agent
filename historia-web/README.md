# Pokémon GPT Historia Web — Showdown integration (technical alpha)

Independent app under `historia-web/`. **Does not modify Pokémon 5e Digital Bookgame, bookgame saves, or `bookgame-canonical`.** The lore is canonical through 2056, next World Cup is 2060 (every four years). Historical 2056 ranking data is exposed read-only; it is *not* proof of 2060 qualification.

## Start

Requires Node.js 22+ and network connectivity for the initial dependency installation:

```bash
cd historia-web
npm install --no-audit --no-fund
npm test
# Install Chromium once, then test real desktop + mobile browser:
npx playwright install chromium
npm run test:browser
npm start
```

Open http://localhost:3000 and select **Arena > Avvia allenamento tecnico 6v6**. Choose **manuale** to send Luke's real move/switch decisions or **automatica** to watch the bots. Alternatively supply *two* Showdown packed-format teams with six Pokémon each. The terminal winner and battle events come only from the installed official `pokemon-showdown` package, using its self-hosted `BattleStream` simulator and split player/spectator streams.

Environment:
- `PORT`: HTTP listener, default 3000.
- `HISTORIA_DATA_DIR`: server-local persistence directory, default `historia-web/.data/` (should be on a persistent volume). It contains **only Historia** files; never mount a Pokémon 5e save directory.
- `OPENAI_API_KEY`: optional server-only key for the narrative Master AI. `OPENAI_MODEL` defaults to `gpt-4.1-mini`.
- `HISTORIA_PUBLIC_ORIGIN`: exact HTTPS browser origin when behind a reverse proxy; for direct/local HTTP the server compares Origin with the Host.

`GET /api/status`, `GET /api/competition`, `GET /api/battles`, `GET /api/battles/:id`, `POST /api/battles` and `POST /api/battles/:id/choice` form the local API. `GET/POST /api/chat` support the optional Master. The browser polls the authenticated *player request* through the local API and displays only public spectator events. A replay after completion is saved to `.data/battles/` and can be opened from **Replay** by the owning session. A browser-generated 40-character hexadecimal session secret is sent in the `X-Historia-Session` HTTP header for private chat, replay, match and choice APIs; never put this secret into URL query strings. Cross-device restoration uses the same secret. This is **capability-based experimental access**, not a production login system: anyone obtaining the secret can use that session. Manual external replay imports (`POST /api/replay`) are always marked unverified and **cannot** register a victory.

## Verification and scope

`npm test` includes protocol unit tests, an upstream Showdown integration test and 6v6 manual/automatic end-to-end tests which verify authentic `|win|` events and persistence. See `.github/workflows/historia-web.yml` for the dedicated CI. Do not treat source-code presence as proof that a real battle has been tested successfully; check the corresponding workflow run.

**Implemented / partial:** manual control, bot vs bot spectator mode, real 6v6 simulator, public log, turn-by-turn visual replay and filesystem persistence, evidence-bound technical reports available without an API key, optional narrative chat, historical ranking read-only, responsive single-page arena. Bots use a **deterministic tactical heuristic**, reading only their own private Showdown request and the already-public spectator log. The controller considers public type matchups, HP, healing, hazards, observed status, switches, and Mega/Dynamax options. Profiles: Luke (adaptive), Mattew (technical), Daniel (analytical), Edward (offensive), Fab (creative), and generic balanced; the training Arena has a style selector. These are **behavioral approximations, not certified competitive AI** and do not impersonate historical tournament decisions. External animated Showdown sprites require Internet access.

**Not yet complete / not official:** a validated Historia custom format allowing all canon species/forms and the exact Mega + Dynamax policy, a verified canonical major-legendary species registry, a full multiplayer spectator/fog-of-war audit, player authentication, trustworthy 2060 roster and qualifiers, canonical fixtures/standings/knockout integration, deployment, native Showdown replay animation/graphics, competitive tactical AI, physical mobile browser testing and multi-server recovery. `gen8customgame` is a **technical development format**, not the certified Lega GPT ruleset. Practice matches must never update World Cup standings.

Origin protection, in-memory rate and concurrency limits, CSP, and private file permissions are now present and tested. Public deployment STILL requires genuine login and session revocation, HTTPS, reverse-proxy configuration, distributed quotas, audited dependencies, monitoring, secure backups, and a separate security review. This remains a private technical alpha.

## Canonical merge

The branch `historia-web-showdown-integration` incorporated the independent historical `historia/src/battle-session.mjs`, `save.mjs`, `showdown-bridge.mjs` and `storage.mjs` plus tests in a two-parent Git merge commit without altering existing Bookgame code. The official `historia/src/showdown-bridge.mjs` validates terminal log receipts; tournament standings are deliberately left read-only until verified 2060 entrants and matching fixtures are available.


## Phase 3 verified evidence (2026-10-09)
- An authentic simulator match Mega Evolves Venusaur then Dynamaxes **another Pokémon**, Arcanine, and reaches a Showdown-authored winner. This is an integration test, not mocked combat.
- The current official Showdown Dex and actual battle choice requests disallow Dynamax for Zacian, Zacian-Crowned, Zamazenta, Zamazenta-Crowned, and Eternatus. The browser protocol adapter independently excludes those moves.
- Server-side team vetting rejects Z-Crystals, Z/Max moves in sets, Gigantamax flags, Terastallization, nonstandard IV/EV ceilings, repeated items, non-six teams and levels other than 100. An Alpha nickname does not alter base stats.
- Match ownership is enforced before server returns a *private* Luke request, accepts a move or lists saved results. The public battle log is sourced only from Showdown's spectator stream; tests assert no `|request|`, `|split|` or `|error|` packets are persisted there.
- **No official fixture begins yet**: `official:true` is rejected by the BattleService, until confirmed 2060 entrants/teams and a canonical major-legendary registry exist. A list supplied by a client must **never** be interpreted as authoritative canonical rules.
- `gen8customgame` is still a development-only format. Showdown Gen8 cannot automatically certify every newer regional form or all custom League GPT constraints. No CI success on this test fixture should be read as proof of a complete 2060 format.


## Tactical NPC controller — verified scope
The new `tactical-ai.mjs` is local and requires no LLM or API key. For each turn, it ranks **only** actions enumerated by `legalChoices(request)`, computes matchup estimates using public species/type/move information from the installed Showdown Dex, and chooses the highest-scored legal action. If the opponent has not yet revealed its active species, the controller does not query hidden teams, moves, ability, EVs, item, or the omniscient stream; it defaults to neutral scoring. Personality modifiers never override the simulator's legal action list. Stable tie-breaking makes profile choices reproducible.

The system does **not** predict hidden builds, simulate an exact damage roll, account for every item/field interaction, implement competitive team-planning/search, or guarantee strategically optimal decisions. The official Showdown simulation remains authoritative. Phase 4 completion requires demonstrated decisions against the canonical 2060 NPC datasets once those are available.


## Battle replay and factual post-match studio (phase 5)

After a **completed and server-verified** Showdown match, choose **Riproduci replay** in Arena or open the saved match in **Replay**. The Arena presents public turn-by-turn snapshots, visible active Pokémon, known HP percentages/status, move/KO/Mega/Dynamax/weather events, and previous/next, seek and play/pause controls. The implementation reconstructs the public game events for browsing; it is **not the official Showdown replay player** and does not re-execute attacks or calculate damage. Sprite GIFs are requested from external Showdown infrastructure and require Internet; missing sprites fall back to labels.

Choose **Analisi tecnica verificata** to see a deterministic factual report, *even if no OpenAI API key is configured*. It counts observed attacks, arrivals/switches (including initial appearances), faints, Mega and Dynamax activations and links notable log events to their recorded turn. It **does not** claim to know a player's intentions, make unsupported predictions, measure optimality, or extrapolate win percentages. The **Commento del Master AI** remains optional and server-key-powered; its system context includes the factual report plus a bounded real spectator-log excerpt.

New private read-only APIs, both protected by the secret X-Historia-Session header:
- GET /api/battles/:id/replay: a verified Showdown-spectator transcript transformed into turn-by-turn frames and report.
- GET /api/battles/:id/analysis: factual report without all replay frames.

Neither endpoint accepts uploaded logs as authoritative, grants access to a different session, nor returns an ongoing battle as a verified result. Both derive the output from the persisted spectator transcript, checking that the terminal winner/tie matches the recorded battle result. Manual imports stay **unverified** and never produce verified playback.

Automated regression includes a real 6v6 Showdown battle fetched from both endpoints, privacy denial, incomplete-match denial, timeline event and field reconstruction, HP and transformation consistency, safe textContent-only UI rendering, embedded browser-script syntax and the legacy Historia tournament tests. Full end-to-end visual tests on mobile browsers remain open.


## Browser, touch and restart verification (phase 6)

A dedicated Playwright Chromium job in the Historia-specific workflow tests **real browser behavior** in two viewport configurations: desktop 1280×800 and mobile touch 390×844. It verifies responsive layout without horizontal page overflow, usable 44px touch buttons, real manual moves sent to the installed Showdown simulator, visually navigable replay and the evidence-based report.

The 6v6 recovery test launches a **separate Node server**, runs a complete Showdown match from the browser, persists its server-verified terminal log in an isolated temp directory, terminates Node, starts a fresh Node process using the same directory, reloads the browser, and verifies the same private replay, report, archive and winner are available. A different session still receives HTTP 404. It also checks displayed live Pokémon species and publicly observed HP/status (unknown HP remains unknown).

Run locally with Node.js 22+ and an installed Playwright Chromium browser using npm run test:browser. GitHub CI provisions Chromium and OS libraries with the documented Playwright CLI. On failure, GitHub Actions retains the browser HTML report, traces and screenshots for debugging. This is Chromium mobile emulation, **not** a physical Android/iOS or Safari test. The tests now cover both **completed replay restoration** and **live manual battle recovery after a server process restart**, using the same filesystem directory. External GIF sprites require a connection outside the isolated browser smoke suite; images are deliberately blocked during tests to prove the UI remains usable with labels.

This is still technical-alpha Arena, not a deployed 2060 competition product. Full official format, real qualifying teams, match lifecycle recovery, production session authentication/security, and real-device testing remain open.


## Live battle persistence and deterministic restart (phase 7)

When an experimental Historia battle is started, the server creates a private, atomic, owner-bound pending journal named <battle-id>.pending.json in HISTORIA_DATA_DIR/battles/. It includes the two original Showdown packed teams, a server-generated deterministic four-number PRNG seed, the sequence of actual accepted player-side choices with hashes of their private request, and the previously observed **public spectator** transcript. Journal files are written atomically with owner-only file mode 0600; do not expose this directory via static HTTP hosting, git commits, shared file servers or public volumes. Secure backups of the persistent volume are still needed.

A request to reopen an unfinished battle on a new Node process lazy-restores it. The engine starts an authentic Showdown match with the original seed and teams, submits the exact recorded choices, compares every public log event with the previous transcript, and refuses to restore if the game events differ. The one exception is **numeric Showdown '|t:|' wall-clock metadata**: their original timestamps are kept in the final replay because time differs across processes, while move, damage, switch, KO, transformation and winner messages must agree exactly. Private requests are checked against their original hashes where the player stream re-emits them; any currently outstanding choice is obtained from the **actual Showdown battle-side request**, not a fabricated move list. A restored manual request receives a fresh request ID so pre-crash tabs cannot submit stale moves. Successful completed matches remove their private pending journals after the verified replay is saved.

Dedicated tests demonstrate three manual turns, service re-instantiation, continuing until a real Showdown terminal result, and forged public-log rejection. The separate Chromium desktop/mobile test **kills a real Node process during an incomplete manual match**, starts another process against the same directory, verifies its old log/turn, sends another legal move and rechecks session isolation. This is **development-only crash recovery**, not high-availability durability: lost/corrupted volumes, interrupted filesystem writes, simulator upgrades, power loss and simultaneous multiple servers using the same directory are outside guaranteed recovery. The journal contains sensitive trainer builds; production encryption at rest and authentication are still pending.


## Phase 8 — private-alpha security controls

- The server computes exact SHA-256 CSP hashes for the bundled script and stylesheet. Arbitrary inline script, eval, remote API calls, framing and untrusted image sources are prohibited; only the Showdown sprite CDN is allowed for external images. No-store, nosniff, deny-framing and no-referrer security headers are set.
- POST operations require same-origin browser requests; cross-site Fetch Metadata or mismatched/null Origin are rejected. JSON Content-Type is required; malformed and non-object JSON or payloads larger than 50,000 bytes are rejected. Unexpected server failures return generic error messages.
- A bounded, single-process rate limiter uses the actual socket IP, not spoofable forwarded headers. Limits per minute: 8 match creations, 8 chat requests, 20 manual replay imports, 600 choices and 1,200 general requests; HTTP 429 includes Retry-After. A maximum of 2 live matches per session and 24 overall per server process applies. Session/replay caches are capped.
- Session and chat JSON use private 0700 directories and atomically replaced 0600 files. Filesystem names use SHA-256 of the bearer session code, never the raw code. Live journals already use private team storage; keep the persistent disk outside web hosting and backups secure.
- Automated tests check HTTP security headers, CSP hash, CSRF rejection, body and rate limits, actual file permissions, and all existing manual/automatic 6v6 Showdown and Chromium mobile/desktop recovery paths.
- Important: this does not supply account authentication, stolen-token revocation, distributed rate limiting, encrypted backups, high-availability shared sessions, or a complete production security audit. Never deploy the draft PR as a public service on the strength of CI alone.
