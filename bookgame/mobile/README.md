# Step 13 — Native Android, all gameplay offline

This is the **embedded-runtime** host for `bookgame-canonical`, not a new game
engine and not a remote website. The existing Node ESM story, rules, combat and
JSON save engine runs inside the Android app via Capacitor + an embedded Node.js
Mobile runtime. The device WebView opens the server on
`http://127.0.0.1:4173` only. It never connects to a laptop, CDN or external
Node process. Do not set a Capacitor `server.url`.

## Current release limitations

This repository deliberately does **not** check in externally sourced art/audio.
An APK is **not release-ready** until complete, approved Pokémon PNGs, Trainer art,
and the separately supplied MP3 music/effects/cry archive are installed and
`build.mjs` has validated their physical bytes.
Android and iOS are different targets; this step provides an Android build
pipeline only. Device airplane-mode acceptance is still mandatory.

## One-command Trainer integration into the offline APK

The 19-character overlay created from the user-supplied Trainer assets is
**already complete**: 19 portraits, 19 battle-front sprites and 19 overworld
sheets (57 real PNGs). It is delivered separately from Git:

- `P5E_19_Character_Sprites_Offline_Complete.zip`
- **Approved SHA-256:** `6269a74a9381c03941322dd8b8f16b3950ab199c62e488a7d5ed0324368754d9`

The Android build **now imports this local ZIP automatically** when supplied
via `P5E_TRAINER_OVERLAY_ZIP`. It checks the complete ZIP SHA-256, rejects
unmapped/dangerous paths, verifies all 57 individual PNGs against Git-tracked
SHA pins, atomically installs only matching files, and rechecks the **copied
native application payload**, not just files in the checkout.

```sh
# From the repository root; both paths below refer to actual local files.
python3 bookgame/scripts/install-approved-sprite-zip.py /absolute/path/to/P5E_M01-M12_619_Pokemon_Complete_Sprites_verified.zip --strict

cd bookgame/mobile
npm install
npm run android:init   # first time only
P5E_TRAINER_OVERLAY_ZIP=/absolute/path/to/P5E_19_Character_Sprites_Offline_Complete.zip npm run android:debug
```

You can also import explicitly without running Gradle:

```sh
node bookgame/mobile/build.mjs --package --characters-zip /absolute/path/to/P5E_19_Character_Sprites_Offline_Complete.zip
```

When the ZIP has already been installed and remains verified, subsequent builds
are idempotent and can omit the environment variable. An incomplete ZIP, altered
artwork, missing Pokémon asset or mismatched packed payload **fails the build**.
The binary archive is never downloaded at runtime, and neither a placeholder nor
an online sprite server is allowed.

**Limitation:** the verified *619-Pokémon archive* is a separate mandatory
input. This conversation supplies the 19-character overlay, not the 619 archive.
A successful source-only CI run or generated Android shell does not prove a
fully playable offline APK. Finish the above packaging and airplane-mode device
tests before calling the mobile release complete.

## Prepare on a build workstation

Install JDK 21+, Android SDK / Android Studio, Node.js 22+, npm, and the
Android build tools compatible with Capacitor 8. Then at checkout root:

```sh
# Compilation and regression of the canonical engine
npm --prefix bookgame run build
npm --prefix bookgame test

# Install the verified 619-Pokémon sprite archive separately.
python3 bookgame/scripts/install-approved-sprite-zip.py /path/to/P5E_M01-M12_619_Pokemon_Complete_Sprites_verified.zip --strict
npm --prefix bookgame run sprites:verify

# Trainer ZIP import happens automatically during android:debug when
# P5E_TRAINER_OVERLAY_ZIP points to the approved local archive.
# Once installed, you may also verify it independently:
npm --prefix bookgame run sprites:verify:characters

# Mandatory for this music-enabled APK; install the privately supplied pack locally.
# Do not commit its tracks or redistribute without appropriate rights.
npm --prefix bookgame run audio:import -- /path/to/P5E_AudioPack_Mobile_MP3.zip
npm --prefix bookgame run audio:verify

cd bookgame/mobile
npm install
npm run android:init   # first time only; creates android/ generated skeleton
npm run android:debug
```

The APK is produced at
`bookgame/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
The debug build is **for testing only**, not a release-signed distribution.

`npm run build:web` performs: compile canonical scenes; verify 619 Pokémon
sprite mapping against the physical PNGs; verify all checked/pinned Trainer
portraits and native battle/overworld sprites; verify required map graphics;
require every installed audio file, check SHA-256; reject symlinked runtime inputs;
copy the same engine, compiled story, data, scene files, maps and UI into the
native payload; bundle the native startup screen. No test/CI may quietly
replace missing sprites with a placeholder or download them on first run.

Native runtime startup uses `bridge.app.datadir()/careers` for three private,
separate career slots. It must never save to extracted app assets, which an
app update can overwrite. Startup enforces strict offline PNG and Trainer
checks again; errors stop gameplay rather than silently corrupting a save.

## Device acceptance (required before marking PASS)

On a real Android phone, **install and launch the APK with airplane mode on**,
and verify all three career slots: create, autosave, force-close, restart and
continue; Story, Battle, Team, map navigation and menu; offline sprites and
all installed music, battle cues, effects and Pokémon cries; absence of network permissions other than local
loopback traffic, and that updates retain saves. Check cold start and device
rotation. Use Android Studio logcat if the embedded Node runtime fails startup.

The CI suite tests project structure and canonical engine regressions. It
does **not** prove the app installs or plays on a physical device. Only mark
Step 13 PASS after a successful APK build AND device-level airplane-mode test.
