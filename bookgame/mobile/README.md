# Step 13 — Native Android, all gameplay offline

This is the **embedded-runtime** host for `bookgame-canonical`, not a new game
engine and not a remote website. The existing Node ESM story, rules, combat and
JSON save engine runs inside the Android app via Capacitor + an embedded Node.js
Mobile runtime. The device WebView opens the server on
`http://127.0.0.1:4173` only. It never connects to a laptop, CDN or external
Node process. Do not set a Capacitor `server.url`.

## Current release limitations

This repository deliberately does **not** check in externally sourced art/audio.
An APK is **not release-ready** until complete, approved PNGs and Trainer art
have been installed and `build.mjs` has validated their physical bytes.
Android and iOS are different targets; this step provides an Android build
pipeline only. Device airplane-mode acceptance is still mandatory.

## Prepare on a build workstation

Install JDK 17+, Android SDK / Android Studio, Node.js 22+, npm, and the
Android build tools compatible with Capacitor 8. Then at checkout root:

```sh
# Compilation and regression of the canonical engine
npm --prefix bookgame run build
npm --prefix bookgame test

# Install the verified 619-Pokémon sprite archive separately.
python3 bookgame/scripts/install-approved-sprite-zip.py /path/to/P5E_M01-M12_619_Pokemon_Complete_Sprites_verified.zip --strict
npm --prefix bookgame run sprites:verify

# Install the approved Trainer battle/overworld/portrait files via the
# documented canonical character asset importer and check both manifests:
npm --prefix bookgame run sprites:verify:characters

# Optional, ONLY if the audio pack is available and distribution is permitted.
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
verify any installed audio pack's hashes; reject symlinked runtime inputs;
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
(optional installed) music; absence of network permissions other than local
loopback traffic, and that updates retain saves. Check cold start and device
rotation. Use Android Studio logcat if the embedded Node runtime fails startup.

The CI suite tests project structure and canonical engine regressions. It
does **not** prove the app installs or plays on a physical device. Only mark
Step 13 PASS after a successful APK build AND device-level airplane-mode test.
