# Kumpas live demo

## Prepare the laptop

- Use the production preview on a consistent localhost origin.
- Build before the code freeze; prepare offline assets after the final build.
- Test camera permission, microphone recording, and the actual speaker output.
- Enroll three comfortable poses with genuinely separate capture attempts.
- Tap a saved phrase once to enable audio, then test automatic recognition.
- Record the successful path as a clearly labeled backup video.
- Keep the local preview process running. Bring the charger and the expected display/audio adapters.

## Five-minute walkthrough

| Time      | Action                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:35 | Explain a household communication situation: the person chooses poses and phrases; a family member helps with setup.                 |
| 0:35–1:05 | Show phrase buttons and a family recording. Explain that this is a personal vocabulary, not FSL translation.                         |
| 1:05–1:25 | Disconnect external internet and reload. Keep localhost running.                                                                     |
| 1:25–2:35 | Teach a distinct new pose: phrase, recording, three capture attempts, fresh test, release check, save. Have an empty slot available. |
| 2:35–3:20 | Tap once to enable audio, activate the new pose, keep holding to demonstrate no repeat, release, then repeat intentionally.          |
| 3:20–3:45 | Show an unknown pose being rejected and manual phrase playback.                                                                      |
| 3:45–4:15 | Reload offline and show that the saved mapping remains available.                                                                    |
| 4:15–5:00 | Explain the local model, custom classifier, recorded audio, actual evaluation results, and limitations.                              |

Rehearse timing; enrollment may take longer with a new user. Do not promise a judge-chosen gesture will pass if it is outside the supported scope or too similar to another pose.

## Recovery

If a pose fails, check the enrolled hand, lighting, and framing. Retry once. If necessary, show the manual phrase fallback and explain the failed recognition honestly. If hardware prevents continuing, use the labeled backup video. Never present manual playback or a recording as live inference.

## Questions to prepare for

- **What is AI?** MediaPipe hand landmark inference runs locally. A custom example-based classifier maps normalized geometry to a personal phrase.
- **What is trained?** Enrollment stores examples and calibrates matching; the pretrained vision network is unchanged.
- **Why Filipino?** Household phrases, familiar names, and voices in the family's own spoken language are first-class setup inputs.
- **Why offline?** Camera inputs and recordings stay local, and new mappings can be enrolled without a cloud AI service after installation.
- **What if it guesses wrong?** Distance rejection, ambiguity rejection, and continuous holding reduce activations; they do not guarantee reliability. State measured errors honestly.
- **Who tested it?** Give actual testers, trial counts, and hardware. Do not substitute developer unit tests for intended-user validation.
