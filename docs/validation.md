# Kumpas validation record

Checked October 9, 2026 on the local production preview at `http://127.0.0.1:4175/`.

## Passed checks

- `pnpm typecheck`: no TypeScript errors.
- `pnpm test`: 18 tests across five files pass. These cover feature normalization, unknown/ambiguous-class rejection, hold/release activation, audio resource cleanup, and atomic IndexedDB behavior. Classifier fixtures are synthetic; they do not measure personal gesture accuracy.
- `pnpm verify:assets`: local model/runtime hashes and byte sizes match the recorded manifest.
- `pnpm build`: production Cloudflare/Vinext build completes and generates a versioned offline asset manifest.
- Browser workspace and phrase-to-recording-step navigation work.
- Desktop panels share top and bottom bounds. Mobile header, segmented navigation, stacked cards, enrollment inputs, step labels, and actions were visually inspected at 390 pixels; a 320-pixel layout was also inspected during development.
- Offline preparation caches application, worker, model, and WASM assets, then initializes the real model and performs inference on a blank frame.
- The production preview server was stopped after preparation. The root application reloaded from cache with styles and client interactions available. Setup navigation was exercised while the server was stopped.
- With the server still stopped, `/offline-check.html` loaded from cache. Its **Run local inference check** reported: “PASS: actual local model initialized and processed a blank frame. Zero hands returned.” No camera or microphone permissions are needed for this check.
- The preview server was restored after verification.

The browser connectivity badge remained Connected because the operating system still had network access. Server-stopped checks verify that this local origin can serve its cached runtime without its server; they are not a complete device/network privacy audit or a hosted deployment test.

## UI review artifacts

- [Desktop workspace](workspace-desktop.jpg)
- [Mobile workspace](workspace-mobile.jpg)
- [Mobile phrase enrollment](enrollment-mobile.jpg)

The camera is off in these screenshots. They show actual UI output, not fabricated enrolled phrases or simulated recognition results.

## Pending acceptance

- Record, preview, enroll, and save three real phrases with the demo user and caregiver.
- Verify speaker playback, browser audio unlocking, repeated triggers, neutral release, and manual phrase fallback.
- Measure known-pose recognition, unknown-pose rejection, confusion, latency, lighting variation, camera distance, and motor comfort with real examples.
- Recheck the complete enrolled workflow after closing/reopening the browser and after disabling the device network.
- Verify any hosted deployment separately, including service-worker scope and browser storage persistence.
- Gather intended-user feedback and inspect runtime network traffic before making broader privacy or accessibility claims.

The prototype does not translate Filipino Sign Language. Passing these engineering checks does not establish clinical suitability or dependable emergency communication.
