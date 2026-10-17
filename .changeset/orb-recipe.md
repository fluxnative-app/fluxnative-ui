---
"@fluxnative/catalog": minor
---

New `Orb` recipe, the assistant's mark for voice and AI moments, in two looks: `glass` (a glossy sphere in a turning aura) and `pulse` (a core that emits rings and spins an arc while thinking). It takes `state` (idle, connecting, listening, thinking, speaking, error, disabled) and a 0–1 `level` from the voice hook, paints from theme roles (`primary` → `tertiary` by default), runs on one native-driver clock and draws a still frame under Reduce Motion or `paused`. Template builders no longer draw their own orb, which flattened in most voice and AI templates. Ported to react-native-svg from voiceorbs (MIT, Alexis Munoz); the notice travels in the file header and in `THIRD_PARTY_NOTICES.md`.
