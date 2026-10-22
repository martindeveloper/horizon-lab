# Scripts

Generators the checks run (`npm run docs:check`, `docs:catalogue:check`, `shaders:check`,
`credits:check`; each has a `:generate` or plain form that writes) share `lib/generated.mjs`,
so `--check` fails the same way everywhere.

One-off data builds, run by hand when a source changes, and the docs that describe them:

| Script                         | Writes                                                                         | Described in              |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------- |
| `build-planet-maps.mjs`        | `cdn/textures/bodies/<body>/<version>/` (planet, moon maps)                    | `docs/imagery-credits.md` |
| `build-spacecraft-models.mjs`  | `cdn/models/spacecraft/<id>/<version>/` (probes, Parker, observatories)        | `docs/imagery-credits.md` |
| `build-sun-map.mjs`            | the Sun's map alone                                                            | `docs/imagery-credits.md` |
| `build-sun-spot-stencil.mjs`   | `cdn/textures/bodies/sun/spots/<version>/` (Sun Lab spot atlas)                | `docs/imagery-credits.md` |
| `fetch-elements.mjs`           | `packages/toolkit/src/science/elements.ts` (CIAAW weights)                     | `docs/science-sources.md` |
| `fetch-atomic-data.mjs`        | `src/features/spectroscopy/lib/model/atomic-data.json` (NIST)                  | `docs/architecture.md`    |
| `fetch-line-broadening.mjs`    | `src/features/spectroscopy/lib/model/broadening.json` (ABO)                    | `docs/architecture.md`    |
| `fetch-model-atmospheres.mjs`  | `src/features/spectroscopy/lib/model/atmospheres.json`                         | `docs/architecture.md`    |
| `fetch-probe-tracks.mjs`       | `src/space/solar-system/model/probe-tracks.json`                               | `docs/architecture.md`    |
| `fetch-observatory-orbits.mjs` | `src/space/solar-system/model/observatory-orbits.json` (Hubble, Chandra, Webb) | `docs/science-sources.md` |
| `fetch-star-distances.mjs`     | `src/space/star-distances.json`                                                | `docs/science-sources.md` |
| `fetch-solar-structure.mjs`    | `src/space/sun/model/structure.json` (Model S)                                 | `docs/science-sources.md` |
| `fetch-sunspots.mjs`           | `src/space/sun/model/sunspots.json` (SILSO, group numbers)                     | `docs/science-sources.md` |
| `fetch-solar-regions.mjs`      | `src/space/sun/model/regions-2024-05.json` (NOAA/SWPC regions)                 | `docs/science-sources.md` |
| `generate-social-assets.mjs`   | share images under `public/`                                                   | `docs/branding.md`        |
| `analyse-audio.mjs`            | `cdn/audio/<slug>.map.json` and `bench/fixtures/audio-maps/` (audio maps)      | `docs/architecture.md`    |

`pull-cdn.mjs` (`npm run cdn:pull`) mirrors the published maps, the Sun's spot stencil and the
spacecraft models into `cdn/` for the tests. Models are versioned like maps (`SPACECRAFT` in
`src/space/spacecraft/models.ts`), the stencil by `VERSION` in its build; both builds print each
new folder's upload command (name models to the spacecraft build to build only those).
Each body's maps are versioned on their own. After rebuilding one, bump its `version` in
`packages/toolkit/src/bodies/maps.ts` and upload only its new folder with an R2 token scoped
to `horizon-cdn` (an AWS CLI profile with the R2 endpoint), here Earth's v2:

```sh
aws s3 cp cdn/textures/bodies/earth/v2/ s3://horizon-cdn/textures/bodies/earth/v2/ --recursive \
  --content-type image/webp --cache-control "public, max-age=31536000, immutable" \
  --profile horizon-cdn
```

Each script's header comment gives its sources and the exact command. `lib/net.mjs` fetches
text and caches downloads; `lib/colour.mjs` converts between sRGB and linear light.
