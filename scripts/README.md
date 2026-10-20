# Scripts

Generators the checks run (`npm run docs:check`, `docs:catalogue:check`, `shaders:check`,
`credits:check`; each has a `:generate` or plain form that writes) share `lib/generated.mjs`,
so `--check` fails the same way everywhere.

One-off data builds, run by hand when a source changes, and the docs that describe them:

| Script                        | Writes                                                        | Described in              |
| ----------------------------- | ------------------------------------------------------------- | ------------------------- |
| `build-planet-maps.mjs`       | `public/textures/orrery/` (measured planet and moon maps)     | `docs/imagery-credits.md` |
| `build-sun-map.mjs`           | the Sun's map alone                                           | `docs/imagery-credits.md` |
| `fetch-elements.mjs`          | `packages/toolkit/src/science/elements.ts` (CIAAW weights)    | `docs/science-sources.md` |
| `fetch-atomic-data.mjs`       | `src/features/spectroscopy/lib/model/atomic-data.json` (NIST) | `docs/architecture.md`    |
| `fetch-line-broadening.mjs`   | `src/features/spectroscopy/lib/model/broadening.json` (ABO)   | `docs/architecture.md`    |
| `fetch-model-atmospheres.mjs` | `src/features/spectroscopy/lib/model/atmospheres.json`        | `docs/architecture.md`    |
| `fetch-probe-tracks.mjs`      | `src/features/deep-field/lib/model/probe-tracks.json`         | `docs/architecture.md`    |
| `generate-social-assets.mjs`  | share images under `public/`                                  | `docs/branding.md`        |

Each script's header comment gives its sources and the exact command. `lib/net.mjs` fetches
text and caches downloads; `lib/colour.mjs` converts between sRGB and linear light.
