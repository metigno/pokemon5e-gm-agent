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
- `HISTORIA_AUTH_MODE`: `capability` (default private local alpha) or `accounts` (separate registered player accounts; secret cookie and CSRF). `NODE_ENV=production` refuses to boot unless `accounts` is enabled AND `HISTORIA_PUBLIC_ORIGIN` is an HTTPS origin. No OpenAI API key is required for account login.

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


## Phase 9 — actual local accounts and revocable sessions

To test accounts locally: run `HISTORIA_AUTH_MODE=accounts npm start` and open `http://localhost:3000`. The Home screen replaces the anonymous secret-code field with a username/password registration and login form, explicit logout, and **Disconnetti tutte le sessioni**. Usernames allow 3–30 letters, numbers or underscore; passwords require 12–128 characters. Username uniqueness is case insensitive; there is no automatic password reset or email verification. Avoid reusing valuable passwords.

Passwords are protected by per-account random salts with Node.js `scrypt` (cost N=16384, r=8, p=1), not stored in plaintext. The browser uses a randomly generated 256-bit opaque session cookie (HttpOnly, host-only, SameSite=Strict; Secure on HTTPS deployments). Only its SHA-256 digest is stored server-side. Sessions expire after seven days and may be revoked immediately by logout or by incrementing the account authentication version via logout-all. All account/session files use private 0700 directories and 0600 files. Every state-changing cookie request except login/register requires a per-session CSRF token obtainable only by authenticated same-origin JavaScript and checked with constant-time comparison. Auth endpoints are limited to six attempts per IP per minute (in-memory). Different accounts cannot access one another's matches or replays.

Ownership is bound to the permanent account UUID-derived internal key, **not** the temporary login cookie. A player can log out and back in without losing their own saved matches or interrupted training battles, and logout-all invalidates all previous cookies even across Node restarts. The old anonymous `X-Historia-Session` header is ignored in account mode. Anonymous guest saves are **not** automatically imported into accounts (doing so would be insecure); plan an authenticated explicit migration flow before enabling accounts on a server with existing guest data.

For hosting behind a TLS reverse proxy, configure `NODE_ENV=production`, `HISTORIA_AUTH_MODE=accounts`, `HISTORIA_PUBLIC_ORIGIN=https://your-trusted-domain.example`, and a private persistent `HISTORIA_DATA_DIR`. Terminate HTTPS at your trusted proxy, block direct public access to the Node backend, and route requests to the same host. The backend deliberately does not infer TLS from spoofable forwarded HTTP headers. It issues cookies with the `Secure` flag when `HISTORIA_PUBLIC_ORIGIN` is HTTPS. The production configuration check deliberately refuses legacy capability mode or any HTTP/public-origin omission; this guard is **not** a replacement for deploying and validating TLS.

Tests cover scrypt password storage, cookie and CSRF enforcement, login/re-login with persistent replay ownership across genuine Node restarts, cross-account isolation, session expiry and revocation, live account browser UX on desktop/touch Chromium, production config fail-closed, and previous canonical, battle and private-capability mode regressions. Account/credential recovery, email verification, user deletion, distributed session DB locks, backups/encryption, external audits and a full HTTPS proxy integration test remain outstanding. Keep PR in draft and do not advertise it as a public-ready game.


## Phase 10 — isolated Railway HTTPS staging and explicit guest import

### Railway (prepared, not deployed)

The new service-local railway.toml under historia-web/ declares a Railpack build, production npm install, npm start, /api/status healthcheck, and bounded restarts.
Use GitHub repository metigno/pokemon5e-gm-agent; branch historia-web-showdown-integration; Railway root directory /historia-web; one replica; persistent dedicated volume mounted at /data. Do not reuse Bookgame data.

Required service variables:
- NODE_ENV=production
- HISTORIA_AUTH_MODE=accounts
- HISTORIA_DATA_DIR=/data/historia
- HISTORIA_PUBLIC_ORIGIN=https://THE-ACTUAL-GENERATED-RAILWAY-HOST.up.railway.app (replace only with the confirmed HTTPS domain from Railway)
- PORT is supplied by Railway; OPENAI_API_KEY remains optional

Check a terminal Railway SUCCESS, HTTPS /api/status, Secure HttpOnly SameSite=Strict account cookie, blocked insecure/cross-origin POST and a registration/login/logout smoke before advertising the site.

Railway resource inspection on 2026-10-09 found the preexisting lega-gpt-showdown service (different repo, last deployment FAILED) and librogame5e-web-preview (Bookgame). Attempting to create a separate private pokemon-gpt-historia-staging project returned: Free plan resource provision limit exceeded. Please upgrade to provision more resources! Thus NO staging project/service/domain/volume was created, NO existing service was modified or deleted, and there is NO verified live Historia URL yet. A freed resource or increased Railway plan capacity is needed to perform a real HTTPS deployment.

### Explicit guest-save import

Under HISTORIA_AUTH_MODE=accounts, a logged-in player may use the Home panel Importa vecchi salvataggi anonimi to import only finished Showdown replay files, chat history, and eligible last-battle pointer, using the previous anonymous 40-hex code. This requires both an authenticated HttpOnly account cookie and a valid per-session CSRF token. No automatic import at login. The backend rejects live pending battles, leaves the game engine log/winner intact, records a private owner-pinned migration marker, and rejects claims by other accounts. Same-account repeated imports are idempotent.

Endpoint POST /api/auth/import-guest expects JSON with legacyCode, never a URL query string. Guest codes are sensitive bearer secrets and must never be pasted into logs, issue trackers or public chats. A partially interrupted import can be resumed only by the account that first claimed the transfer. Only one Node replica is supported during migration; cross-process transactions and distributed locks remain outside scope.

Automated tests cover idempotency, nonexistent codes, ownership conflicts, live-battle refusal and an actually completed 6v6 Showdown replay imported via authenticated HTTP and still available after a real process restart. The HTTPS proxy smoke checks rejected HTTP Origin, accepted HTTPS Origin, and Secure host-only cookies locally; it does not constitute a live Railway TLS test.

## Phase 11 — durable storage readiness and encrypted offline backups

**Railway is still blocked by the Free-plan provisioning quota; no new Historia service or URL was deployed.** These changes only harden the dedicated Historia application branch, with no Bookgame modifications.

### Storage readiness

Production (`NODE_ENV=production`) refuses to start without an explicit ABSOLUTE `HISTORIA_DATA_DIR`. Its parent directory must already exist, so an unmounted `/data` parent normally prevents boot. The app checks directory type, rejects symlinks, constrains permissions to 0700 and verifies a temporary 0600 write/read/delete. Existing valid volume directories are accepted. `GET /api/ready` repeats the write/read/delete check; Railway `railway.toml` now uses this endpoint for readiness (200 with `{ready:true}`; 503 if inaccessible). Local development can still use a relative test directory.

**Limitation:** a successful filesystem probe proves current writability, NOT that Railway attached a genuinely durable volume, that the volume has backups, or that a future disaster is recoverable. Verify the /data mount using the Railway dashboard. One Node instance remains required; multi-process shared filesystem locks are not supported.

### Backups — offline only

Stop the Historia Node service (or otherwise ensure no writes are occurring) before creating a backup. Set `HISTORIA_BACKUP_PASSPHRASE` to a strong **unique secret of at least 16 characters** through a trusted environment/secret manager. Never put it in the command-line arguments, issue tracker, git, chat, or a public `.env` file.

Commands from the `historia-web/` directory:

```bash
node scripts/backup.mjs create --data-dir /data/historia --out /secure-backups/historia-2026-10-09.hbk
node scripts/backup.mjs verify --input /secure-backups/historia-2026-10-09.hbk
node scripts/backup.mjs restore --input /secure-backups/historia-2026-10-09.hbk --data-dir /absolute/empty-restore-directory
```

The `.hbk` archive is an authenticated AES-256-GCM encrypted gzip-compressed JSON snapshot with a random salt, unique nonce, scrypt key derivation, and SHA-256 checksums for every private JSON record. It includes finished battles, in-progress battle journals, account/password-hash records, revocable session-token digests and CSRF state, chat, last-battle pointers and migration markers. It intentionally never archives API keys or process environment. Lost backup passphrases **cannot be recovered**.

Restore first verifies the passphrase, GCM authentication tag, every path and checksum; it refuses a nonempty target, builds new private 0700/0600 files in a staging directory and atomically renames the staging tree into an empty destination. It does **not** merge with active account data and it should never be used to overwrite a running Railway volume. Restore to a separate empty directory, validate, then plan a controlled maintenance transfer. `.hbk` files are gitignored but must additionally be stored in protected external backup storage.

Limits: maximum 10,000 JSON files, 4 MiB each and 64 MiB plaintext across the archive, which is sufficient for current alpha tests but **not yet suitable for arbitrarily large public account populations**. This is a single-process offline snapshot, not an automated hot backup or cross-region disaster recovery service. No real account data was exported in this development step.

Automated Node regression tests cover backup creation, CLI create/verify, AES-GCM tamper and incorrect-passphrase rejection, refusal to overwrite populated targets, refusal of symlink traversal and out-of-directory archives, actual restored equality, private file permissions, production missing-volume failure and storage probes. Existing 6v6 Showdown, canonical Historia and desktop/touch Chromium E2E remain in CI.
