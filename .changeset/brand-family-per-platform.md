---
'@fluxnative/tokens': minor
'@fluxnative/catalog': minor
---

A brand's named font family now works on Android. React Native takes one family name per role, and Android ships none of the named families a brand may use (Georgia, Menlo, Courier), so a template's display face silently fell back to the system sans there. A template's `theme/tokens.ts` now picks per platform at run time: iOS draws the named family, Android the stack's generic (`serif`, `monospace`), the web the whole stack. It imports `Platform` from react-native only when a role names a family; the kit's own tokens are unchanged.
