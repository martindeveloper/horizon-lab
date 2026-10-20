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
        layout.tsx             Feature CSS + simulationLayout (messages, persistent scene)
        page.tsx               Default scene: simulationMetadata
        [hole]/page.tsx        Preset route: static params + simulationMetadata
      orrery/
        layout.tsx             Feature CSS + simulationLayout (messages, persistent scene)
        page.tsx               Default view: simulationMetadata
        [view]/page.tsx        View route: static params + simulationMetadata
      deep-field/              The same three routes for Deep Field's views
      spectroscopy/            The same three routes for Stellar Spectra's views
  components/
    shell/                     AppShell, header, phone menu, preferences, theme switch, stage sizing
    simulations/               Shared simulation stage: the lab route layout
                               (simulation-layout.tsx), the client boundary and WebGL gate
                               (webgl-gate.tsx: simulationClient), immersive view, loading,
                               technical details; the view picker (view-picker.tsx) and the
                               view-from-URL hook (use-view-from-path.ts); for zoomable scenes
                               the canvas host (scene-canvas.tsx) and its label words
                               (use-scene-labels.ts), side rail, selection sheet, the
                               Orrery–Deep Field link (handoff-link.tsx); the guide card every
                               simulation's tour shows (guide-card.tsx), the journey caption
                               with its dwell and tour controls (guide-caption.tsx) and the
                               guide's keys (use-guide-keys.ts)
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
      bench.ts                 Headless benchmark target: the engine on its store (src/space/bench.ts)
      components/              HUD overlay, selection cards, canvas host
      components/overlay.tsx   Overlay composition; panels, cards and the time dock beside it
      lib/model/               The solar system through time, on the shared model (src/space):
        timeline.ts            Slider segments, epochs, dated notes, playback
        views.ts               The default view and the Motion speed-up by scale
        tour.ts                Guide steps and their flights
        catalogue/             The timeline's figures: value or span, unit, source, status
        solar-activity*.ts     The Sun's illustrative activity
        parameters.ts, equations.ts, model-check.ts
      lib/graphics/            The time-dependent sky (sky.ts), tour-sketch.ts,
                               map-loader.ts (WebP maps from MAP_BASE; scripts/build-planet-maps.mjs),
                               shader-defines.ts, shaders/
      lib/scene/               The engine: engine.ts hosts the shared solar system on the
                               toolkit's scene host, orbit rig and controls, moves it along
                               the timeline and adds what is the Orrery's own: the sky,
                               close-ups (close-up-controller.ts, close-up-flight.ts),
                               measured maps, the guide, solar activity, picking and the HUD
      lib/store.ts             Zustand store (orrery namespace messages)
    deep-field/
      index.ts                 Public client entry: DeepFieldApp
      manifest.ts, routing.ts, server.ts, technical.json
      bench.ts                 Headless benchmark target: the engine on its store (src/space/bench.ts)
      components/              Overlay, depth ladder, sightline, guide caption, the Objects
                               and View panels, cards, canvas host
      lib/model/               Today's sky at every scale, without three.js scenes:
        view-ids.ts, views.ts  The fifteen views, inner planets to the observable universe,
                               and how each one's distances are known (METHOD_OF)
        depth.ts               The ladder's log scale and the sightline (distance,
                               light-travel time, redshift, Earth when the light set out)
        tour.ts                The guided journey, planets to the first light: its shots
        cosmos.ts              Named galaxies and clusters at today's places, the observable
                               universe, camera aims
        neighbours.ts          Nearest stars and their closest approaches (Gaia astrometry)
        galactic-orbit.ts      The Sun's place in the Galaxy and its recent path
        probes.ts              Our reach: five probes on their JPL Horizons tracks
                               (probe-tracks.json, scripts/fetch-probe-tracks.mjs), the
                               heliopause they crossed, sunlight's light-time rings
        catalogue/             Every figure a card prints: value or span, unit, source, status
      lib/graphics/            Point clouds (galaxy.ts, cosmos.ts), the bright-star sky, looks.ts
      lib/scene/               The engine: the shared solar system held at today, then the
                               reach (probes, heliopause, light-time rings), stars, Galaxy and
                               cosmos layers (cosmos-layer.ts fades what cosmos-clouds.ts draws,
                               cosmos-rings.ts and cosmos-marks.ts), on the toolkit's scene
                               pieces; each layer registers what its names open (label-picks.ts);
                               camera-rig.ts turns the orbit rig's frame and aim between the
                               scales, lod.ts blends them, guide-director.ts flies the journey on the
                               toolkit's tour camera (as the Orrery's guide does)
      lib/store.ts             Zustand store (deepField namespace messages)
    spectroscopy/
      index.ts                 Public client entry: SpectroscopyApp
      manifest.ts, routing.ts, server.ts, technical.json
      components/              The stage (scene canvas and spectrum), dock, line card with its
                               level diagram and curves, Elements and Display panels, guide;
                               spectrum-view/ keeps the ribbon, plot, labels and gestures as
                               hooks and pure helpers beside the component
      lib/scene/               The scene canvas's layout, still-scene painters and photon flock
      lib/model/               The physics, without React or the DOM:
        atoms.ts               Elements, NIST lines and partition functions (atomic-data.json
                               from scripts/fetch-atomic-data.mjs)
        atmospheres.ts         ATLAS9 photospheres (atmospheres.json from
                               scripts/fetch-model-atmospheres.mjs)
        populations.ts         Saha and Boltzmann
        profile.ts, voigt.ts   Line shapes: Doppler, Voigt, hydrogen collisions (broadening.json
                               from scripts/fetch-line-broadening.mjs), Stark
        continuum.ts           The stars' continuous opacity: H⁻, hydrogen, scattering
        spectrum.ts            The bench's uniform slab, the stars' layered LTE transfer, the
                               instrument and pixels; line reports and curves of growth
        telluric.ts            Earth's O₂ A and B bands
        scenes.ts, stars.ts    What each view observes: bench, named stars, mysteries; the
                               settings' ranges and defaults
        glow.ts                A glowing gas's colour and brightness, for the scene
        equations.ts, tour.ts  The formulas the documents print; the guided journey
      lib/store.ts             Zustand store (spectroscopy namespace messages)
  lib/
    sources.ts                 Shared bibliography the catalogue figures cite
    facts.ts                   Catalogue fact and card-spec types, and their printers
    scene-store.ts             What a zoomable scene's store shares (`sceneSlice`), the guide
                               machine of every stepped guide (`guideSlice`) and `asideOpen`
    scene-bridge.ts            An engine's side of that store: turns, flights, ready, the HUD
                               readouts it publishes (`createSceneHud`), what the HUD publishes
                               on the stage (`stageClearance`), redraws on a motion-preference
                               change and the camera's side of the Orrery–Deep Field crossing
                               (`bridgeHandoff`)
    handoff.ts                 One-shot note that a visitor crossed between the Orrery and
                               Deep Field at a solar system view, with the camera's pose, so
                               the other side opens where this one left off
    simulation-types.ts        Registry contract
    simulation-paths.ts        Shared `/lab` prefix, path helpers and preset slug routes
    simulations.ts             Registry and active-app matching
    redirects.ts               Native Next.js compatibility redirects
    metadata.ts                Page metadata: pageMetadata, simulationMetadata, localeParam
    credits.ts                 Imagery, data, font and package credits for /credits
  space/                       Shared astronomy for the shell, catalogue and simulations:
    messages/                  The shared copy (units, distance words, HUD chrome, the solar
                               system's names), merged under each one's namespace (messages.ts)
    star-catalogue.ts           Shared bright-star positions, magnitudes and colours
    observer-sky.ts             Observer location and apparent Sun, Moon and star positions
    bright-stars.ts            The catalogue's bright stars on the sky sphere, as points
                               carried with the camera (`createBrightSky`, `carrySky`)
    bench.ts                   A scene engine on the bench: its frame loop driven frame by frame
    quality.ts                 What a render quality means for every space scene: tier,
                               resolution, swarms, the bloom chain, the lens's star
    solar-system/              The solar system at any moment, for any host engine:
      model/                   parameters, equations, moment (migration, growth, the gas
                               disk), elements, tracers, catalogue, views (and the solar
                               framing every host engine shares), framing, position
      graphics/                looks.ts, swarms.ts, moons.ts, shader-defines.ts, shaders/
      scene/                   solar-system.ts composes the Sun, planets, moons, populations
                               and the reticle (*-layer.ts, focus-ring.ts) on a kit (kit.ts)
                               with its own level of detail (lod.ts)
      format.ts                Names and orbit rows both simulations print
      cards.ts                 The figures the population cards quote (`POPULATION_FIGURES`)
  i18n/                        Shared request/routing/navigation configuration
  messages/                    Shared catalogue, shell, and error copy
bench/                         Headless rendering benchmark: CLI, bundling, reports
public/simulations/            Static catalogue artwork
packages/toolkit/
  package.json                 Explicit subpath exports, no root barrel
  src/ui/                      Domain-free controls, dialog, loading and tokens
  src/math/                    Scalar interpolation, log-scale controls, seeded random, value noise
  src/science/                 Constants, units, shared laws, ΛCDM cosmology, sky coordinates,
                               catalogued facts and their printers
  src/camera/                  Per-instance projection, orbit input, flights and framed views
  src/rendering/               Shader pass, engine host, frame loop, sizing, disposal and the
                               engine lifecycle (startEngine, withScope)
  src/scene/                   Scene host, the kit its layers are built with (`SceneKit`), orbit
                               rig and controls on a log zoom, labels (and scene.css), taps,
                               rulers, HUD readouts, presence, sky frames
  src/shaders/                 Reusable GLSL snippets and assembly
  src/environment/             Shared media queries: reduced motion, pointer type, wide layout
  src/storage/                 Session and local cells: lifetime, decay, codecs
  src/bench/                   Benchmark contract, in-page runner, timing and image statistics
  src/bodies/                  Sun, planets, moons: JPL elements, IAU figures and spin, rings,
                               Sun/Moon almanac, measured-map credits; bodies/surfaces paints
                               body maps
```

The locale layout owns navigation, providers, fonts, and monitoring. It must not
import a renderer or store. The catalogue imports only lightweight manifests
through the registry and uses static preview art; links disable prefetch so a
catalogue visit does not prefetch the entire observatory.

Feature internals may depend on the shared UI library and i18n navigation. Other
features and shared code must use public entries (`index`, `manifest`, `routing`,
`server`, `bench`) rather than importing a simulation's private `lib`, `hooks`, or
`components`. Keep these boundaries explicit in imports. `server.ts` is marked
server-only and must never be imported from a Client Component.

Each simulation's layout owns its canvas lifetime. Navigating between its presets
or views keeps that layout mounted; leaving the feature unmounts it and runs the existing renderer,
listener, subscription, and WebGL resource cleanup. Canvas discovery is scoped
to the feature root through data attributes, never translated accessible labels
or a global selector. Feature CSS is scoped to that same root. The shared stage
fits the remaining viewport below the header; the catalogue retains normal
page scrolling.

## Routes and compatibility

| Route                      | Purpose                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                        | Catalogue                                                                                                                                    |
| `/lab/black-hole`          | Default black-hole scene                                                                                                                     |
| `/lab/black-hole/m87`      | Preset                                                                                                                                       |
| `/m87`                     | Permanent redirect to the preset route                                                                                                       |
| `/lensed`                  | Permanent redirect to the default scene                                                                                                      |
| `/lab/orrery`              | Orrery, default view (the giant planets)                                                                                                     |
| `/lab/orrery/oort`         | Orrery view (inner, kuiper, scattered, oort)                                                                                                 |
| `/lab/orrery/oort-cloud`   | Permanent redirect to the canonical view                                                                                                     |
| `/lab/deep-field`          | Deep Field, default view (the Milky Way)                                                                                                     |
| `/lab/deep-field/laniakea` | Deep Field view (heliosphere, stars, local-group, local-sheet, virgo-cluster, virgo-supercluster, laniakea, cosmic-web, observable-universe) |
| `/lab/spectroscopy`        | Stellar Spectra, default view (the Sun)                                                                                                      |
| `/lab/spectroscopy/stars`  | Stellar Spectra view (kirchhoff, stars, mystery)                                                                                             |
| `/black-hole/...`          | Permanent redirect to the same `/lab` page (pre-prefix URL)                                                                                  |
| `/orrery/...`              | Permanent redirect to the same `/lab` page (pre-prefix URL)                                                                                  |
| `/en/...`, `/cs/...`       | Served in that language, then shown as the clean path                                                                                        |

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
`orrery`, `deepField`) alongside shared messages to its nested `NextIntlClientProvider`; the
space simulations' copy includes the shared `src/space/messages/` (see
[Zoomable scenes](#zoomable-scenes)). Feature components use
`useTranslations("blackHole")`; route metadata loads that same feature catalog.
Only the selected language is sent to the client. The catalogue receives no
scientific lessons, tour copy, or other feature messages.

The language switch writes the locale cookie and reloads the same URL (query
string and hash preserved). A full load is required: the locale layout is a root layout that owns
`<html>`, so a client-side route change would remount the theme provider and
re-render its inline theme script, which React refuses on the client.

Server Components receive the validated locale from route params: `localeParam(params)`
(`src/lib/metadata.ts`) narrows it to a known locale or renders the 404. Pass it explicitly
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
4. Add `[locale]/lab/<slug>/layout.tsx` and `page.tsx`. The layout imports the
   feature's stylesheets and exports `simulationLayout({ slug, namespace, App, messages })`
   (`src/components/simulations/simulation-layout.tsx`), which loads only that feature's
   translations beside the shared ones and keeps the scene mounted across its routes.
   Use the shared stage/shell components and keep browser-dependent scenes behind a
   client-only boundary.
   Wrap the overlay in `SimulationImmersive` and give its header `SimulationToolbar`
   (`src/components/simulations/simulation-toolbar.tsx`), which keeps every
   simulation's tools in one order and holds the immersive toggle (see
   [Immersive view](#immersive-view)).
   Give it a lifecycle: its store is a module and outlives the page, so the root
   component the layout keeps mounted calls `useFreshVisit(freshVisit(store))`
   (`src/components/simulations/use-fresh-visit.ts`). Leaving the simulation puts the store
   back as it was first made: no guide still running, no selection, panel or switch
   carried into the next visit. Keep any remembered state in the store, not in module
   variables, so the reset reaches it too.
5. Export `simulationMetadata({ path, messages, image })` (`src/lib/metadata.ts`) from
   the page; a `[slug]/page.tsx` passes `view` (its param, `resolve`, `pathFor` and the
   view's title) instead of `path`, sets `dynamicParams = false` and exports the
   feature's static params. Build the feature's `routing.ts` on
   `slugRoutes({ base, ids, defaultId, aliases })` so slugs, aliases, static params and
   redirects behave like the other simulations.
   Add compatibility redirects only when replacing existing URLs.
6. Extend tests for the new feature's entry points and copy coverage. Run
   `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
7. Optionally add `bench.ts` exporting a `benchTarget` so `npm run bench` can time
   and capture the renderer headlessly ([bench/README.md](../bench/README.md)).
   It launches a browser, so run it only when asked.

Automated checks cover catalogue entries, translation parity, routing, namespace
separation, and import boundaries; they do not replace visual and interaction testing.

## Zoomable scenes

The Orrery and Deep Field share one engine, split between the toolkit (no app code) and
thin app adapters. A new simulation that zooms across scales reuses all of it and keeps
only its layers, its views and its store of its own:

- **Stage:** `SceneCanvas` (`src/components/simulations/scene-canvas.tsx`) owns the canvas
  and the label layer, and hands the engine a `SceneMount` with live label text and
  language (`useSceneLabels` words them). `useViewFromPath` keeps the store's view on the URL,
  and with a `pathFor` the URL on the view too, as Stellar Spectra's guide needs. Route
  layouts import `@horizon/toolkit/scene.css` for the labels.
- **Engine:** `createSceneHost` (renderer, camera, frame loop, `tight` devices, shader
  warm-up, anti-aliasing, bloom and lens: draw each frame through its `render`), `createOrbitRig` (pose, log zoom, flights that turn the angles; the feature
  adds limits, the aim's `home` and the frame's `orient`), `createViewMoves` (its views,
  as the pose framing each) and `createOrbitControls` (drag, wheel, pinch).
  `createLabels`, `createTapPicking`, `createAnchoredRulers`, `createDistanceText` and the
  presence helpers serve the layers; `createSceneHud` (`src/lib/scene-bridge.ts`) publishes the scale bar and the nearest
  view a few times a second, plus the feature's own readouts.
- **Store:** `sceneSlice` (`src/lib/scene-store.ts`) gives the shared fields and actions:
  `flight`, `turn`, `ready`, `distanceUnit`, `quality`, `antialias`, `bloom`, `lens` and the scale bar; the
  feature adds its view, selection and switches. `guideSlice` is the guide's machine (open
  keeping the visitor's settings, step within the tour, end giving them back); the feature adds
  what its own guide sets per step. Its caption is `GuideCaption`, its keys `useGuideKeys`, and
  the engines build on `withScope`, `stageClearance`, `bridgeHandoff` and
  `invalidateOnMotionChange`. `bridgeStore` acts once on each button turn
  and view flight, ignores the view the HUD writes during a frame, and reports the first frame;
  `bridgeRender` hands the engine each new quality level and the host the anti-aliasing and
  the bloom and lens switches, publishing the device's default anti-aliasing while none is
  chosen; the engine sets the bloom chain's and the lens star's size for the level
  (`spaceQuality`'s `bloom` and `lens`).
- **Quality:** every simulation maps the shared `RenderQuality` to its own settings in one
  file, `lib/quality.ts`, and passes the result down: engines and layers take numbers (a
  resolution, point counts, map budgets, ray steps), never the level or the device class.
  The space scenes share `src/space/quality.ts`: `sceneTier` (Standard keeps each device's
  old tier, Economy and Cinematic pin one, Max goes past both), `sceneResolution` and the
  solar system's swarm counts; the Orrery (`orreryQuality`: sky counts, map budget and
  filtering, close-up maps, prominence steps) and Deep Field (`deepFieldQuality`: the cosmic
  maps' sampling) add their own. A change of level reaches the layers live, right after the
  control repaints: point clouds are sampled afresh, budgets change, and resident maps take
  the new filtering. Max holds a low-memory device's buffer and resident maps to what it can
  keep. The
  black hole's `BLACK_HOLE_QUALITY` holds ray steps, traced share and work budget; Spectra's
  `lib/quality.ts` holds its canvas pixel caps and its wide-colour rule.
- **Panels:** `Rail` and `RailSection` for side panels (`sheetLead` adds phone-only
  sections), `SelectionSheet` for cards, both
  ending above the dock, which publishes its height as `--hud-clear` on the stage
  (`useDockClearance`). Each zoomable simulation keeps two panels apart: **Objects**
  (things to find; `SolarObjectPicks` lists the solar system's) and **View** (how the map
  is drawn: layers, switches, the distance unit, the `CameraPad`, then render quality), built from
  `SwitchChips` (the toolkit's switch rows in a panel, its switch chips in a dock),
  `DistanceUnitControl`, `RenderSection` and `MapScale`. Its frame-rate switch is one for every
  simulation (`src/lib/frame-rate.ts`, in memory); on, it drops smaller switches for the
  readout's parts (graph, vsync, memory where the browser reports it). The readout
  (`FrameRateReadout`, mounted by `SimulationImmersive`) is the toolkit's `FrameStats` on its
  `frameMeter`, in the stage's top-left corner. `RenderSection`
  (`src/components/simulations/render-settings.tsx`) ends every simulation's settings panel:
  render quality (Economy, Standard, Cinematic, Max: `RenderQuality`), anti-aliasing (the modes
  the simulation can draw), the simulation's render switches (`BloomSwitch`: bloom on the
  Sun, the gas disk, the Milky Way and bright stars, or on the black hole's disk, jet and
  sky; `LensSwitch`: diffraction spikes on the brightest of that light and a colour fringe
  towards the corners; `GlowSwitch`: a soft layer under Stellar Spectra's lights and a halo
  on its ribbon's strong emission lines; each off by default, stored like anti-aliasing), an
  optional note and Reset, which puts the panel back as a visit starts (`resetView`; the
  black hole re-applies its preset and turns bloom and the lens off). Its copy is the shared `render`
  namespace. Standard is always the default and what the simulation drew before the choice
  existed; what each level and mode does is the simulation's own. `useSceneEscape` lets Escape undo
  one thing at a time.

**Shared worlds.** What more than one simulation draws lives in `src/space/`, below the
features and above the toolkit: it may use app code (`@/lib/facts`, the sources) but never
a feature. It holds the bright-star sky (`brightStarGeometry`) and the solar system as
one unit: `createSolarKit(basics)` and
`createSolarSystem(kit, parent, { place, hideAll, setBodies, rulers })`, drawn each frame at
a `SolarMoment`. The Orrery moves that moment along its timeline and adds close-ups, its sky
and the guide; Deep Field holds it at `TODAY`, adds what we have sent out (the probes, the
heliopause, light-time rings) and carries on past it. Its copy (names,
views, orbit rows, units, HUD chrome) is `src/space/messages/`, merged under each
simulation's namespace by its `server.ts` (`withSpaceCopy`); a key in both is an error.

The Orrery and Deep Field name the solar system's views alike. `HandoffLink` opens the same
view in the other, and `src/lib/handoff.ts` carries the camera's pose so it opens where this
one left off; neither feature imports the other.

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
with that loader as `fallback`. Stellar Spectra draws with Canvas 2D and SVG and needs no gate. It probes WebGL 2 once per page session before the
renderer chunk downloads: without it the stage shows a WebGL status page, and a
CPU-only renderer gets a dismissible slow-performance notice over the scene.

Each page or simulation layout also renders `<DebugCrash scope="route" />` so
`Horizon.Debug.crash()` can reach its route error boundary. The console helpers
(`src/components/debug/`) load lazily after hydration and change nothing until called.
They mount only with `DEBUG` from `src/config.ts` (development and previews), and
without it the stored overrides in `src/lib/debug.ts` are ignored.

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
one `MusicPlayer` from `@horizon/toolkit/audio` with a playlist from the CDN:
`interstellar-drift`, `aeolian-static`, `drifting-probe` and `low-drone-rises`, each as
`.webm` (Opus) and `.m4a` (AAC).
The player owns playback: two streaming decks crossfade for 8 s where a track ends,
the playlist wraps, and Web Audio gains fade play (3 s) and pause (1.5 s). The bed
plays at `MUSIC_LEVEL.ambient` (0.75); a drift lifts it to `MUSIC_LEVEL.drift` (1)
and may hold the playlist on its simulation's track (`useDriftMusic`), never
starting music the visitor has off. The page
preconnects to the CDN; the first track buffers when the toggle is hovered or
focused, or at once when the session had music on. Otherwise nothing loads before
the first play; the next track buffers 30 s before its crossfade, or on
a skip, which blends over 2.5 s. Hidden tabs fade out and resume on return. While
music plays, the toggle opens a sun dial: each track is an hour on a day arc, and
skipping carries the sun to the next. Until sound arrives (the first play, a
skip, a stall), the lens stays half lit and light runs across the waveform. The choice lasts for the browser session;
after a reload the music resumes on the first interaction.

To add a track, cut its intro and outro fades so it blends at full level, strip
metadata and encode at −22 LUFS (measure with `-af ebur128` and set the gain),
keep each file under 4.5 MB, upload it and add it to the playlist:

```sh
ffmpeg -ss <start> -to <end> -i source.wav -map_metadata -1 -fflags +bitexact \
  -flags:a +bitexact -af volume=<gain>dB -c:a libopus -b:a 80k track.webm
ffmpeg -ss <start> -to <end> -i source.wav -map_metadata -1 -fflags +bitexact \
  -af volume=<gain>dB -c:a aac_at -b:a 112k -movflags +faststart track.m4a
```

libopus still writes an `ENCODER` stream tag; remux the WebM once to drop it:
`ffmpeg -i track.webm -map_metadata -1 -map_metadata:s:a -1 -fflags +bitexact -c copy clean.webm`.

Tracks live on the CDN as `audio/<slug>.webm` and `.m4a` (see CDN assets). Without
the bucket's CORS headers Web Audio plays silence.

## CDN assets

Large binaries live in the `horizon-cdn` R2 bucket, served from
`cdn.horizonlab.observer` with CORS and one-year immutable caching, not in the
repo. `src/lib/assets.ts` builds their URLs from `CDN_URL` in `src/config.ts`
(`NEXT_PUBLIC_CDN_URL` overrides it), and the locale layout preconnects to the origin. The ignored `cdn/`
folder mirrors the bucket's keys:

- `audio/<slug>.webm`, `.m4a`: the ambient playlist.
- `textures/orrery/v1/<body>-<tier>.webp`: the measured maps (`MAPS_KEY`), written by
  `scripts/build-planet-maps.mjs`. `npm run cdn:pull` fetches the published set, which
  the map tests check; without it they skip.

A published key is never overwritten, so older deployments keep their assets: rebuilt
maps take the next `MAPS_KEY` version and a new mix takes a new name. Uploading is in
`scripts/README.md`. Further kinds follow the layout (`models/<feature>/`).

## Immersive view

Every simulation uses the same immersive view; never build a feature-specific
one. The app adapter `src/components/simulations/immersive.tsx` wraps the
toolkit's `ImmersiveScene` and `ExperienceMenu` with shared copy (`immersive.*`
and `drift.*` in the root catalogs) and the `[data-simulation]` stage:

```tsx
<VisualizationShell id="main-content" tabIndex={-1} className="h-full">
  <MyCanvas />
  <SimulationImmersive
    onEnter={closeMyTour}
    drift={{ state, music: DRIFT.music, onToggle, onStop }} // with a drift (below)
  >
    <MyOverlay /> {/* its SimulationToolbar ends with the experiences button */}
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

### Drift

Drift is the lean-back mode: the scene enters immersive view, the music lifts,
and the camera flies itself from shot to shot until the visitor pauses it, takes
the camera (a drag or a zoom pauses it) or leaves (Esc, the exit control, the end
of fullscreen). The Black Hole, the Orrery and Deep Field have one; Stellar
Spectra has no camera, so its experiences button enters immersive view directly.

- `src/lib/drift.ts` holds the shared state (`DriftState`, `driftSlice` for the
  stores: start, pause, resume, toggle, stop, with `open` and `close` hooks for
  what each simulation clears) and the shape of a programme.
- `src/features/<slug>/lib/drift.ts` is the simulation's programme: its music
  (`track` from the playlist, `level`), the camera settings (pace, variance, hold
  orbit and push, order) and the shots. Deep Field's and the Orrery's shots name a
  view plus nudges; the observatory's are poses in M with roll. The Orrery's
  programme also visits bodies: a `closeUp` shot is a handoff to the close-up
  (the drift selects the body, the close-up flies in at `closeUp.pace` times its
  usual flight time, the director circles it and drifts nearer for the hold, then
  lets the selection go so the close-up flies out and no marker stays), and `clock` holds the
  Motion speed-up to a few hundredths of a year per second while the drift is on,
  so the inner planets and the belt glide rather than whirl; the rate shows under
  the drift's controls (`SimulationImmersive`'s `drift.caption`).
- The toolkit runs the camera: `createDriftRun` from the store's `drift` state,
  and `createRigDrift` on an orbit rig. A director beside each rig engine
  (`lib/scene/drift-director.ts`) resolves the shots to the rig's framings and
  adds what is the simulation's own (the Orrery's close-up visits); the
  observatory's engine runs the drift directly on its raymarched camera. The
  engine's `fly`, HUD view sync and auto-orbit stand aside meanwhile, and the
  camera comes back to the visitor where it stopped. The line art (orbits, the
  grid, light-time and lookback rings, trails, rulers) fades out over the
  toolkit's `createLineVeil` around each render and back when the drift ends; the
  cosmic web's filaments are content (`userData.content`) and stay, as do names.
- `SimulationToolbar`'s `drift` prop (the store's `startDrift`) puts the drift in
  the experiences button; `useSimulationDrift(state, store, programme, caption?)` gives
  `SimulationImmersive`'s `drift` prop, which carries the state into the immersive
  controls (pause, Space, a music mute, the exit control as stop) and runs
  `useDriftMusic`. Leaving immersive view stops the drift. `tests/drift.test.mjs`
  checks every programme and the stores' transitions.

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
- **Model numbers live once.** A model's parameters (the solar system's
  `src/space/solar-system/model/parameters.ts`: Sun's age, galactic year, the young disk…;
  Deep Field's arm pitch and halo) feed both its code and the text of its formulas, which
  are built from them.
- **Figures in copy are arguments, not typed digits**: "One lap in {galacticYearMyr} million
  years". In the Orrery and Deep Field every one comes from the feature's catalogue: cards
  through `components/card-specs.ts`, and notes, guide and technical prose through its
  `PROSE_FIGURES` and `proseArgs(figures, locale)` (`src/lib/facts.ts`), which print each
  figure in the unit its sentence names. Pass them to `t()`; for technical prose, pass
  `figures` (or plain `values`) to `SimulationTechnicalDetails`.
- **Card figures come from a catalogue.** A model's catalogue (the solar system's
  `src/space/solar-system/model/catalogue.ts`, each feature's `lib/model/catalogue/`) holds every
  number a selection card prints, literature values included: a value or a published span
  (never an invented midpoint), a unit of the science kit, the unit the copy words it in
  (`show`), significant figures, a source id from the shared bibliography
  (`src/lib/sources.ts`) and a required status. It references model constants and toolkit
  bodies instead of copying them, and derives what follows from physics (Kepler's third
  law, the parallax law, angular separation, light-time) with the kit's laws. Messages keep
  only the words ("About {value} galaxies"). `src/lib/facts.ts` holds the fact and
  card-spec types and prints them as `card-specs.ts` declares (one entry per object: badge,
  rows, body and caution arguments): `figure`, `span`, `buildCard`, `staticCard`, lengths
  through `formatDistance` in the visitor's unit, large numbers in words ("6.5 billion").
  The default unit is `auto`: au below half a light-year, ly beyond. `SelectionSheet`
  (`src/components/simulations/`) shows the resulting card.
  `npm run docs:catalogue` writes the catalogues and their sources into
  `docs/science-sources.md`. `tests/orrery-catalogue.test.mjs` and
  `tests/deep-field.test.mjs` check sources, units, statuses and rendering in both
  languages; `tests/simulation-shared.test.mjs` checks every card message's placeholders.
- Shader-only steps, vector rotations and sampling recipes stay as plain text in
  `technical.json`.
- **Shaders type no numbers either.** A lab's shader parameters live in its
  TypeScript (`lib/parameters.ts`; the solar system and the Orrery collect theirs in
  `graphics/shader-defines.ts`) and are written by `npm run shaders:generate` into a
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
