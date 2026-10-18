---
title: Architecture
description: How Horizon is organised, which code owns what, and how to add a simulation.
sidebar_position: 1
tags: [architecture, next.js, routing, i18n, simulations]
---

# Architecture

## Ownership

```text
src/
  app/[locale]/
    layout.tsx                 Shared providers, chrome, monitoring
    page.tsx                   Catalogue entry point
    lab/                       Shared simulation prefix (SIMULATION_PREFIX)
      black-hole/
        layout.tsx             Feature messages, CSS, persistent scene
        page.tsx               Default scene + metadata
        [hole]/page.tsx        Preset route + metadata
      orrery/
        layout.tsx             Feature messages, CSS, persistent scene
        page.tsx               Default view + metadata
        [view]/page.tsx        View route + metadata
  components/
    shell/                     AppShell, header, preferences, theme switch, stage sizing
    simulations/               Shared simulation stage: WebGL gate, immersive view, loading
    pages/                     About and credits page bodies
    status/                    Brand-specific error-page composition and its locale
  features/
    catalogue/index.tsx        Server-rendered catalogue; styles.css holds tiles, hero and intro
    black-hole/
      index.ts                 Public client entry: BlackHoleApp
      manifest.ts              Serializable catalogue description
      routing.ts               Preset URL and redirect helpers
      server.ts                Server-only locale message loader
      bench.ts                 Headless benchmark target (see bench/README.md)
      components/              Observatory-specific UI
      hooks/                   Preset navigation and scientific formatting
      lib/                     Domain state, physics, shader body, engine orchestration;
                               frame.ts fills uniforms for both the engine and bench.ts
      messages/en.json         Feature copy (blackHole namespace)
      messages/cs.json
      styles.css               Scoped feature styles
    orrery/
      index.ts                 Public client entry: OrreryApp
      manifest.ts, routing.ts, server.ts, technical.json
      components/              HUD overlay, selection cards, canvas host
      components/overlay.tsx   Overlay composition; panels, cards and the time dock beside it
      lib/model/               What the orrery shows, without three.js scenes:
        timeline.ts            Slider segments, epochs, dated notes, playback
        elements.ts            Planet and named-body orbits along Neptune's migration
        tracers.ts             The planetesimal sample and its populations
        galactic-orbit.ts      The Sun's Galactic orbit, trail and laps
        cosmos.ts              Beyond the Galaxy: ΛCDM scale factor, the Milky Way–Andromeda
                               orbit, named galaxies and clusters, camera aims
        views.ts               Camera views and along-orbit drift by scale
        neighbours.ts          Nearest stars on straight-line tracks (Gaia astrometry)
        tour.ts                Guide steps and their flights
        catalogue.ts           Every figure a card prints: value, unit, range, source
        parameters.ts, equations.ts, figures.ts, model-check.ts
      lib/graphics/            three.js building blocks: looks.ts (textures, materials),
                               sky.ts, galaxy.ts, cosmos.ts, swarms.ts, moons.ts, coordinates.ts,
                               map-loader.ts (WebP maps from MAP_BASE; scripts/build-planet-maps.mjs),
                               tour-sketch.ts, shader-defines.ts, shaders/
      lib/scene/               The engine: engine.ts wires the toolkit engine host, orbit
                               input and store to one layer per part of the picture
                               (*-layer.ts) through a shared kit and per-frame state (kit.ts);
                               lod.ts is the one level of detail every layer reads (screen
                               size, presence bands, faders, hysteresis, the solar↔Galaxy
                               and Galaxy↔cosmos blends); measured-maps.ts budgets surface
                               maps from it;
                               camera-rig.ts (one log-distance zoom), close-up-controller.ts
                               (+ close-up-flight.ts), guide-director.ts, picking.ts,
                               labels.ts, rulers.ts, hud.ts
      lib/store.ts             Zustand store (orrery namespace messages)
  lib/
    stars.ts                   Shared bright-star catalogue (shell sky and orrery sky)
    simulation-types.ts        Registry contract
    simulation-paths.ts        Shared `/lab` prefix, path helpers and preset slug routes
    simulations.ts             Registry and active-app matching
    redirects.ts               Native Next.js compatibility redirects
    metadata.ts                Shared page metadata helper
    credits.ts                 Imagery, data, font and package credits for /credits
  i18n/                        Shared request/routing/navigation configuration
  messages/                    Shared catalogue, shell, and error copy
bench/                         Headless rendering benchmark: CLI, bundling, reports
public/simulations/            Static catalogue artwork
packages/toolkit/
  package.json                 Explicit subpath exports, no root barrel
  src/ui/                      Domain-free controls, dialog, loading and tokens
  src/math/                    Scalar interpolation, log-scale controls, seeded random, value noise
  src/science/                 Physical constants and display-scale selection
  src/camera/                  Per-instance projection, orbit input and flights
  src/rendering/               Shader pass, engine host, frame loop, sizing and disposal
  src/shaders/                 Reusable GLSL snippets and assembly
  src/environment/             Shared media queries: reduced motion, pointer type
  src/storage/                 Session and local cells: lifetime, decay, codecs
  src/bench/                   Benchmark contract, in-page runner, timing and image statistics
  src/bodies/                  Sun, planets, moons: JPL elements, IAU figures and spin, rings,
                               measured-map credits; bodies/surfaces paints body maps
```

The locale layout owns navigation, providers, fonts, and monitoring. It must not
import a renderer or store. The catalogue imports only lightweight manifests
through the registry and uses static preview art; links disable prefetch so a
catalogue visit does not prefetch the entire observatory.

Feature internals may depend on the shared UI library and i18n navigation. Other
features and shared code must use public entries (`index`, `manifest`, `routing`,
`server`, `bench`) rather than importing a simulation's private `lib`, `hooks`, or
`components`. Architecture tests enforce that boundary. `server.ts` is marked
server-only and must never be imported from a Client Component.

Each simulation's layout owns its canvas lifetime. Navigating between its presets
or views keeps that layout mounted; leaving the feature unmounts it and runs the existing renderer,
listener, subscription, and WebGL resource cleanup. Canvas discovery is scoped
to the feature root through data attributes, never translated accessible labels
or a global selector. Feature CSS is scoped to that same root. The shared stage
fits the remaining viewport below the header; the catalogue retains normal
page scrolling.

## Routes and compatibility

| Route                   | Purpose                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/`                     | Catalogue                                                                                                                          |
| `/lab/black-hole`       | Default black-hole scene                                                                                                           |
| `/lab/black-hole/m87`   | Preset                                                                                                                             |
| `/m87`                  | Permanent redirect to the preset route                                                                                             |
| `/lensed`               | Permanent redirect to the default scene                                                                                            |
| `/lab/orrery`           | Orrery, default view (the giant planets)                                                                                           |
| `/lab/orrery/galaxy`    | Orrery view (inner, kuiper, scattered, oort, stars, galaxy, local-group, local-sheet, virgo-cluster, virgo-supercluster, laniakea) |
| `/lab/orrery/milky-way` | Permanent redirect to the canonical view                                                                                           |
| `/black-hole/...`       | Permanent redirect to the same `/lab` page (pre-prefix URL)                                                                        |
| `/orrery/...`           | Permanent redirect to the same `/lab` page (pre-prefix URL)                                                                        |
| `/en/...`, `/cs/...`    | Served in that language, then shown as the clean path                                                                              |

Every simulation lives under `SIMULATION_PREFIX` (`src/lib/simulation-paths.ts`).
Build manifest paths with `simulationPath(slug)`; the manifest type rejects any
other `href`. Redirects go straight to the canonical page, never through a chain.

URLs never carry the language. Pages are still prerendered under an internal
`[locale]` segment (`/en/...`, `/cs/...`). Static `afterFiles` rewrites in
`src/lib/redirects.ts` serve a clean path from the `cs` pages when the `NEXT_LOCALE`
cookie is `cs`, and from the `en` pages otherwise. Old `/en` and `/cs` links still
serve their prerendered page. `LocaleUrl` in the locale layout then sets or clears
the cookie and replaces the address with the clean path. Next.js does not send
config headers with redirect responses, so a redirect could not set the cookie.

`src/lib/redirects.ts` consumes the feature's public compatibility map. Next.js
serves these redirects before rendering, preserving query strings automatically.
The home page is the catalogue and must never redirect into a simulation.
Unknown paths are 404s. Known locale/preset pages are prerendered; there is no
request-time locale proxy or dynamic fallback route.

## Messages and themes

Root catalogs contain only shell, catalogue, preferences, and error text. Each
feature layout loads its own language file and passes its namespace (`blackHole`,
`orrery`) alongside shared messages to its nested `NextIntlClientProvider`. Feature components use
`useTranslations("blackHole")`; route metadata loads that same feature catalog.
Only the selected language is sent to the client. The catalogue receives no
scientific lessons, tour copy, or other feature messages.

The language switch writes the locale cookie and reloads the same URL (query
string and hash preserved). A full load is required: the locale layout is a root layout that owns
`<html>`, so a client-side route change would remount the theme provider and
re-render its inline theme script, which React refuses on the client.

Server Components receive the validated locale from route params. Pass it explicitly
to `getTranslations` and server-rendered localized links; there is no request-time
locale middleware to infer it. Client Components use the shared locale provider.

Theme state belongs to the shared provider/header. Features consume semantic
UI tokens; space canvases use invariant `space` colors. Do not add another theme
or language switch inside each feature. All navigation uses the localized
helpers from `@/i18n/navigation`.

## Adding a simulation

1. Create `src/features/<slug>/` with its private components, state, data, styles,
   and messages. Export the entry component separately from server helpers.
2. Add a serializable `manifest.ts` satisfying `SimulationManifest`, with a
   stable ID, URL from `simulationPath(slug)`, static artwork, message key, highlight keys, and optional
   entry points (an empty list is fine). Never import the renderer into a manifest.
3. Register the manifest in `src/lib/simulations.ts`. Add its catalogue copy to
   both shared locale files under `catalogue.<messageKey>`: `title`, `eyebrow`,
   `category`, a one-sentence `description`, `open`, one short label per
   highlight key, and `entryPoints.<id>.title` for each entry point. The
   catalogue tile and header then pick it up automatically; keep the copy short.
4. Add `[locale]/lab/<slug>/layout.tsx` and `page.tsx`. Load only that feature's
   translations and styles in its layout. Use the shared stage/shell components
   and keep browser-dependent scenes behind a client-only boundary.
   Wrap the overlay in `SimulationImmersive` and put `SimulationImmersiveToggle`
   in its toolbar (see [Immersive view](#immersive-view)).
5. Add route metadata and static params for any presets. Build the feature's
   `routing.ts` on `slugRoutes({ base, ids, defaultId, aliases })` so slugs,
   aliases, static params and redirects behave like the other simulations.
   Add compatibility redirects only when replacing existing URLs.
6. Extend tests for the new feature's entry points and copy coverage. Run
   `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
7. Optionally add `bench.ts` exporting a `benchTarget` so `npm run bench` can time
   and capture the renderer headlessly ([bench/README.md](../bench/README.md)).
   It launches a browser, so run it only when asked.

Automated checks cover catalogue entries, translation parity, routing, namespace
separation, and import boundaries; they do not replace visual and interaction testing.

## Technical documentation

Each simulation should own a `technical.json` specification (section IDs, equations,
and source references) and localized prose in its feature message namespace.
`packages/toolkit/src/ui/technical-details.tsx` renders an already localized
`TechnicalDocument` in a native modal with shared UI tokens; it does not import
feature state or physics. The feature adapter resolves the message keys.
Keep these documents out of the lightweight catalogue manifest.

For black-hole, `npm run docs:generate` produces the feature README from the same
JSON, English messages, and preset definitions; `npm run docs:check` detects drift.
All preset subpages share one renderer, so its README lists their configuration
differences rather than repeating the technical explanation for each preset. Explain executed algorithms and approximations;
do not infer capabilities from lesson captions or comments alone.

## Bundle isolation

Catalogue links use `prefetch={false}`: opening or hovering over a card must not
fetch a simulation. Each simulation owns its route layout, CSS import, message
provider, and client entry. Keep heavy rendering dependencies behind the feature's
client-only dynamic import; do not re-export them from the catalogue manifest.
Shared React/Next.js, localization, theme, and navigation code loads once and is
reused between routes.

`src/styles.css` is the only Tailwind utilities bundle. It scans shared code,
the catalogue, and every feature directory. A feature stylesheet holds only its
own scoped rules (keyframes, selectors under its `data-simulation` root) and
must not import Tailwind's utilities: CSS stays loaded after a client-side
navigation, and a second utilities bundle appearing later in the document lets
its plain utilities (`relative`, `hidden`) override the shared bundle's
responsive variants (`lg:absolute`, `md:block`) on every other page. The cost
is a few kilobytes of feature-only utilities on the catalogue; the alternative
is a layout that breaks after visiting a simulation.

After `npm run build`, run `npm run test:bundles`. This checks prerendered HTML
(including preload references), the client-reference manifest, and emitted chunks
for both locales. It verifies that renderer/shader JavaScript and feature CSS are
absent from catalogue pages, that feature routes include their stylesheet, and
that no feature stylesheet carries a utilities layer of its own.
`npm test` also guards the catalogue's disabled prefetching. These checks require
no server or browser. Assets already fetched during an earlier simulation visit
can remain cached; leaving a route does not unload JavaScript from browser memory.

## Loading and recovery

The locale `loading.tsx` uses only the manifest registry to choose between a
lightweight catalogue skeleton and the shared simulation loader. Catalogue HTML
stays prerendered, with no hydration gate, artificial delay, or feature prefetch.
Each client-only feature entry must also use `SimulationLoadingPage` (the main
landmark around `SimulationLoading`) while its module downloads, then keep the same loading visual until its renderer reports ready.
Do not design a feature-specific loader; the shared one carries the house motif.
The black-hole canvas raises initialization failures into the route boundary so
an error cannot remain hidden beneath an endless loader.

Wrap each WebGL feature entry in `WebGLGate` (`src/components/simulations/webgl-gate.tsx`)
with that loader as `fallback`. It probes WebGL 2 once per page session before the
renderer chunk downloads: without it the stage shows a WebGL status page, and a
CPU-only renderer gets a dismissible slow-performance notice over the scene.

Each page or simulation layout also renders `<DebugCrash scope="route" />` so
`Horizon.Debug.crash()` can reach its route error boundary. The console helpers
(`src/components/debug/`) load lazily after hydration and change nothing until called.

The locale `error.tsx` provides translated retry/catalogue actions and retains
shared navigation. `global-error.tsx` supplies a standalone recovery document for
root-layout failures. Next.js retains its own emergency server error HTML; the
custom global boundary takes over when React handles the failure.

`global-not-found.tsx` handles unmatched URLs outside the locale layout using
Next.js's `experimental.globalNotFound` option. It is prerendered, restores the
saved theme, and offers both language catalogues without request-time detection.
The locale `not-found.tsx` uses translated copy inside the normal shell. No
catch-all dynamic route or backend is introduced.

## Ambient music

The header's `MusicToggle` drives `ambientMusic` (`src/components/shell/ambient-music.ts`),
one `MusicPlayer` from `@horizon/toolkit/audio` with a playlist from `public/audio/`:
`interstellar-drift` and `aeolian-static`, each as `.webm` (Opus) and `.m4a` (AAC).
The player owns playback: two streaming decks crossfade for 8 s where a track ends,
the playlist wraps, and Web Audio gains fade play (3 s) and pause (1.5 s). Nothing
loads before the first play; the next track buffers 30 s before its crossfade, or on
a skip, which blends over 2.5 s. Hidden tabs fade out and resume on return. While
music plays, the toggle opens a sun dial: each track is an hour on a day arc, and
skipping carries the sun to the next. Until sound arrives (the first play, a
skip, a stall), the lens stays half lit and light runs across the waveform. The choice lasts for the browser session;
after a reload the music resumes on the first interaction.

To add a track, cut its intro and outro fades so it blends at full level, strip
metadata and encode at −22 LUFS (measure with `-af ebur128` and set the gain),
then add it to the playlist:

```sh
ffmpeg -ss <start> -to <end> -i source.wav -map_metadata -1 -fflags +bitexact \
  -flags:a +bitexact -af volume=<gain>dB -c:a libopus -b:a 80k track.webm
ffmpeg -ss <start> -to <end> -i source.wav -map_metadata -1 -fflags +bitexact \
  -af volume=<gain>dB -c:a aac_at -b:a 112k -movflags +faststart track.m4a
```

libopus still writes an `ENCODER` stream tag; remux the WebM once to drop it:
`ffmpeg -i track.webm -map_metadata -1 -map_metadata:s:a -1 -fflags +bitexact -c copy clean.webm`.

## Immersive view

Every simulation uses the same immersive view; never build a feature-specific
one. The app adapter `src/components/simulations/immersive.tsx` wraps the
toolkit's `ImmersiveScene` and `ImmersiveToggle` with shared copy (`immersive.*`
in the root catalogs) and the `[data-simulation]` stage:

```tsx
<VisualizationShell id="main-content" tabIndex={-1} className="h-full">
  <MyCanvas />
  <SimulationImmersive onEnter={closeMyTour}>
    <MyOverlay /> {/* toolbar includes <SimulationImmersiveToggle /> */}
  </SimulationImmersive>
</VisualizationShell>
```

Children render only outside immersive view. The stage gets `data-immersive`,
covers the window and hides the shared header and footer through CSS; the canvas
is never remounted, so WebGL survives. `onEnter` lets the feature close its own
tours or panels without the shared code reading its store. `F` toggles, Esc
leaves. Where `document.fullscreenEnabled` is true the exit control also offers
real fullscreen on the stage; leaving fullscreen leaves immersive view. Other
shared overlays read `useImmersive()` to step aside. `tests/immersive.test.mjs`
fails for any feature that skips the shared pieces or keeps its own.

## Units, constants and equations

Take every number from `@horizon/toolkit/science` (see its README): constants
with their sources, units and conversions, distance readouts, and formulas.
Write the astronomical unit as `au` (IAU 2012 Resolution B2).

- **Formulas are written once.** Shared laws live in the toolkit; a simulation's
  own go in `src/features/<slug>/lib/equations.ts` via `defineEquation`. Its
  `physics` code computes with them, and `technical.json` references them as
  `{ "equation": "<id>" }` instead of retyping the text. The technical-details
  adapter prints `toString()`; the generated README prints `toLatex()` in math
  blocks. Pass the feature's registry to `SimulationTechnicalDetails`.
- **Model numbers live once.** A feature's parameters (the orrery's
  `lib/model/parameters.ts`: Sun's age, galactic year, arm pitch…) feed both its code
  and the text of its formulas, which are built from them.
- **Figures in copy are arguments, not typed digits**, when they follow from a
  constant or a parameter: "1 au = {millions} million km · light-time {minutes} min",
  "One lap in {galacticYearMyr} million years". The orrery's `lib/model/figures.ts`
  supplies them (rounded for print); pass them to `t()` and, for technical prose,
  as `values` to `SimulationTechnicalDetails`.
- **Card figures come from a catalogue.** The orrery's `lib/model/catalogue.ts` holds
  every number a selection card prints, literature values included: value, a unit of
  the science kit, optional range, significant figures and a source id. It references
  model constants and toolkit bodies instead of copying them, and derives what follows
  from physics (Kepler's third law, the parallax law, light-time) with the kit's
  equations. Messages keep only the words ("About {value} galaxies"); `quantity()` in
  `components/format.ts` prints lengths in the visitor's distance unit through
  `formatDistance`. `npm run docs:catalogue` writes the catalogue and its sources into
  `docs/science-sources.md`; `tests/orrery-catalogue.test.mjs` checks sources, units,
  rendering in both languages and that card copy types no digits.
- Shader-only steps, vector rotations and sampling recipes stay as plain text in
  `technical.json`.
- **Shaders type no numbers either.** A lab's shader parameters live in its
  TypeScript (`lib/parameters.ts`; the orrery collects them in
  `lib/graphics/shader-defines.ts`) and are written by `npm run shaders:generate` into a
  committed header, `parameters.generated.glsl`, that the shaders `#include`
  (the list is `scripts/shader-headers.mjs`). Shader sources stay complete for
  editors and offline compilers; nothing is injected at runtime.
  `tests/shader-constants.test.mjs` fails on a stale header, a numeric `const` in a
  lab shader, an unused parameter, or a literal that re-types one, and
  `tests/shader-validation.test.mjs` preprocesses and parses every shader as
  three.js compiles it.

## Shared toolkit boundary

Read [the toolkit guide](../packages/toolkit/README.md) before adding shared code.
The package has its own TypeScript check without the application's `@/` alias.
Its modules never import a feature, Next.js, localization, or Zustand. UI and
numerical entry points cannot pull in the renderer; production bundle checks
protect the catalogue boundary. Client-only engine loading remains in the feature.

The black-hole engine supplies physics, presets, camera limits, warm-up policy,
and uniforms. Toolkit helpers own input listeners, rendering resources, buffer
sizing and scheduling. `SceneCameraProvider` gives the scene and its overlays
one camera snapshot; there is no module-global camera. React, localization,
and store bindings live in thin application adapters.

For other projects, pack/install `@horizon/toolkit` and configure source
transpilation, Tailwind source scanning and GLSL text loading as described in
its README. No publishing or registry credentials are needed for local reuse.
