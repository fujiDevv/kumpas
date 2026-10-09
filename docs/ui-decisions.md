# Kumpas UI/UX decisions

## Reference direction

The user requested `../../ui-design-inspo/` as the UI/UX reference. The implementation takes inspiration from Foglamp's light application overview and setup surfaces, and Craft's restrained controls. Kumpas retains its own original application code and styles.

- Neutral gray app chrome; white primary workspace.
- Small persistent navigation rail on desktop; segmented navigation on narrow screens.
- Rounded, lightly outlined panels instead of decorative dashboard metrics.
- Consistent 8/12/16/24/32-pixel spacing rhythm.
- Sans-serif product typography, readable phrase output, and quieter secondary labels.
- Layered control shadows and clear focus states.
- Shared orange spark logo from SafeShare, copied unchanged at the user's request.

## Interaction priorities

Communication output and manual phrase buttons remain prominent. Camera controls belong to the camera panel; phrase controls belong to the phrase panel. Setup is a three-step sequence, with a separate fresh pose/release check before save.

Use plain errors close to the relevant action. Do not report distances as confidence percentages. Disabled controls should reflect actual prerequisites: a playable recording, an active camera for capture, and completed validation before saving.

The desktop camera and phrase panels align at their top and bottom edges. Narrow screens stack them in reading order. Enrollment labels, inputs, progress, and actions share a left baseline. Button targets remain at least 44 pixels tall in the main flows.

Respect reduced motion, visible keyboard focus, sufficient contrast, and text wrapping. Hide the stale landmark overlay immediately when the camera is paused. Recording indicators and playback status are functional feedback, not ambient animation.

## Review evidence

The initial desktop workspace and a 390-pixel full-page layout were visually inspected in the Codex browser. Final screenshot artifacts and any remaining layout observations are listed in `validation.md`.

A responsive interface is not proof that browser vision inference works on every phone. Intended-user accessibility and motor comfort need separate validation.
