# Kumpas validation record

Checked October 9, 2026 on the local production preview at `http://127.0.0.1:4175/`.

## Passed checks

- `pnpm typecheck`: no TypeScript errors.
- `pnpm test`: 28 tests across six files pass. These cover feature normalization, unknown/ambiguous-class rejection, hold/release activation, audio resource cleanup, and atomic IndexedDB behavior. Classifier fixtures are synthetic; they do not measure personal gesture accuracy.
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

## Recognition correction — October 10, 2026

The updated implementation passes type checking, 28 automated tests, and the production build. Added regressions cover one-attempt false positives, overly broad stored tolerances, inconsistent enrollment being mislabeled as overlap, neutral-pose rejection, relative class ambiguity, depth differences, individual-finger changes, continuous capture, and drift/gap resets. Storage rejects incomplete negative checks and obsolete vector formats on save.

Version 1 phrase records remain intact and manually playable; automatic recognition requires reteaching with version 2 features. The UI marks these phrases and explains the migration. The previous browser/offline checks above describe the earlier build; this recognition correction has not been validated against the user's live camera poses. No new background preview server was started for this correction.

To accept the correction, reteach distinct poses such as open palm, fist, and index pointing; hold a visible non-matching pose during each enrollment check. Verify each intended pose, at least ten other poses/movements, and no hand. Record correct detections and false activations separately. If a pose cannot pass the fresh test, do not save it by relaxing the limits.
