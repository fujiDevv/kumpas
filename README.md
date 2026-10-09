<p align="center">
  <img src="public/images/workshop-spark.png" alt="Kumpas logo" width="112" />
</p>

<h1 align="center">Kumpas</h1>
<p align="center">Personal gestures. Familiar voices. Kahit walang internet.</p>

<p align="center">
  <img src="https://img.shields.io/badge/AppBuildersPH-2026-b84318" alt="AppBuildersPH 2026" />
  <img src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MediaPipe-0.10.32-b84318" alt="MediaPipe 0.10.32" />
  <img src="https://img.shields.io/badge/Inference-On_device-272725" alt="On-device inference" />
</p>

Kumpas helps Filipino families turn a simple hand pose into an everyday message. Choose a phrase, record a loved one's voice, and teach Kumpas a comfortable pose. Hold that pose in front of the camera, and Kumpas shows the message and plays the recording.

For example, a person can choose a pose for **“Ma, pahingi ng tubig”** and hear it spoken in a familiar voice.

The family chooses what each pose means. Kumpas does **not** translate Filipino Sign Language.

## Why we built it

Everyday needs can be difficult to express when speaking is challenging. We are exploring a personal communication tool for someone who can comfortably repeat distinct hand poses, with a family member helping during setup.

A familiar voice makes each message personal. Processing on the device lets the app recognize poses without sending camera frames to a cloud AI service.

## Try it

Use a recent **desktop Chrome or Edge** browser. Allow camera and microphone access when asked.

### 1. Teach a phrase

1. Open **Set up phrases** and choose **Add a phrase** or **Teach your first phrase**.
2. Type a message and record a familiar voice saying it.
3. Choose the hand you will use and start the camera.
4. Hold a comfortable pose for three attempts, following the prompts. Move your hand out of view between attempts.
5. Repeat the pose for the recognition test, then hold a different relaxed pose for the rejection check. Keep your hand visible during this check.
6. Save your phrase.

You can save **up to three phrases**, each with a voice recording of **up to eight seconds**. Recordings can be in any spoken language.

### 2. Communicate

1. Open **Communicate** and tap a phrase once to enable audio playback.
2. Start the camera and briefly hold a saved pose.
3. Kumpas displays the phrase and plays its recording once.
4. Relax or remove your hand before trying again.

Use the same hand you taught Kumpas. You can also tap the large phrase buttons to play messages manually, stop audio, or pause the camera.

### 3. Prepare for offline use

While connected, click **Prepare offline use** and wait for it to finish. Then disconnect, reload the same address, and try a saved phrase.

The app saves its files and AI model for offline use. Phrases and recordings stay in the same browser on the same device. Clearing browser storage can remove them. Test offline use on the device and address you plan to use for the demo.

## How the AI works

**Camera → hand landmarks → personal pose match → recorded message**

MediaPipe detects points on the hand. Kumpas compares their positions with the examples collected during setup. A short hold and a release between activations help prevent repeated playback; unclear matches are rejected.

We use an existing pretrained MediaPipe model. Teaching a phrase creates a personal pose mapping; it does not retrain that model. The voice is a real recording, so no speech generation or translation is needed.

Camera video is not saved by the app. Phrase text, recordings, and pose examples are stored locally in the browser.

## Run locally

Requirements: **Node.js 22.21+**, **pnpm 11.5.1**, and internet for initial setup.

```sh
pnpm install --frozen-lockfile
pnpm prepare:model
pnpm build
pnpm start --host 127.0.0.1 --port 4175
```

Open [http://127.0.0.1:4175](http://127.0.0.1:4175) and keep the preview server running during the demo. Use `pnpm dev` when developing.

## Publish on Cloudflare

Set `CLOUDFLARE_ACCOUNT_ID` to your account ID. For the first deployment:

```sh
pnpm exec cf auth login
pnpm build
pnpm deploy:response-store
pnpm deploy
```

For later app updates, run `pnpm deploy`. Redeploy the response-store Worker if its package or configuration changes. The deploy script includes the offline assets and supports first-time deployment.

After publishing, test camera access, recording, recognition, and offline preparation on the hosted HTTPS address. Hosted offline use has not yet been verified.

## What to know

- Kumpas is a hackathon prototype. Recognition accuracy and suitability for intended users still need hands-on testing.
- It supports three still poses using one hand. Moving gestures, two-hand signs, and sign-language translation are outside the current scope.
- Similar poses, poor lighting, and changes in camera angle can affect recognition. Choose distinct poses and follow the setup checks.
- Saved phrases stay in one browser; there is no account, sync, or backup.

## Built with

React, TypeScript, Vinext, Vite, Tailwind, MediaPipe Tasks Vision, IndexedDB, service workers, and Cloudflare Workers.

## Team

**Techknights** · AppBuildersPH Local AI Hackathon 2026

- Joshua Sarmiento
- John Cedrick P. Siega
- Kc A. Sarmiento

## Development checks

To run the development checks:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Built with assistance from OpenAI Codex. The project uses the existing Vinext/Cloudflare starter and an ImageGen-created spark logo reused from SafeShare. Foglamp and Craft informed the interface design. MediaPipe licenses and notices are included in [public/models](public/models/NOTICE.txt).
