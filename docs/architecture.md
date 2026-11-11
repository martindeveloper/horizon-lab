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
      giants/                  The same three routes for Giants' rungs ([star])
      sun/                     The same three routes for the Sun's views ([view])
    experience/                Shared experience prefix (EXPERIENCE_PREFIX)
      voyage/                  The same three routes for Voyage's places
      afterglow/               The same three routes for Afterglow's chapters
  components/
    shell/                     AppShell, header, phone menu, preferences, theme switch, stage sizing
    simulations/               Shared simulation stage: the lab route layout
                               (simulation-layout.tsx), the client boundary and WebGL gate
                               (webgl-gate.tsx: simulationClient), immersive view, loading,
                               technical details; the view picker (view-picker.tsx) and the
                               view-from-URL hook (use-view-from-path.ts) and the root every
                               lab mounts on them (simulation-root.tsx); for zoomable scenes
                               the canvas host (scene-canvas.tsx) and its label words
                               (use-scene-labels.ts), side rail, selection sheet, the
                               Orrery–Deep Field link (handoff-link.tsx); the guide card every
                               simulation's tour shows (guide-card.tsx), the journey caption
                               with its dwell and tour controls (guide-caption.tsx) and the
                               guide's keys (use-guide-keys.ts); the `?` tour of the controls
                               (help-tour.tsx: `useHelp`, `HelpTour` on the toolkit's `CoachMark`)
    pages/                     About, credits and changelog page bodies; letter.tsx is their
                               shared header and margin-labelled part
    status/                    Brand-specific error-page composition and its locale
  features/
    catalogue/index.tsx        Server-rendered catalogue; styles.css holds tiles, hero and intro
    black-hole/
      index.ts                 Public client entry: BlackHoleApp
      manifest.ts              Serializable catalogue description
      routing.ts               Preset URL and redirect helpers
      server.ts                Server-only locale message loader
      bench.ts                 Headless benchmark target (see bench/README.md)
      components/              Observatory-specific UI, preset navigation and scientific formatting
      lib/                     Domain state, physics, shader body, engine orchestration;
                               frame.ts fills uniforms for both the engine and bench.ts
      messages/en.json         Feature copy (blackHole namespace)
      messages/cs.json
      styles.css               Scoped feature styles
    orrery/
      index.ts                 Public client entry: OrreryApp
      manifest.ts, routing.ts, server.ts, technical.ts
      bench.ts                 Headless benchmark target: the engine on its store (src/space/bench.ts)
      components/              HUD overlay, selection cards, canvas host
      components/overlay.tsx   Overlay composition; panels, cards and the time dock beside it
      lib/model/               The solar system through time, on the shared model (src/space):
        timeline.ts            Slider segments, epochs, dated notes, playback
        events.ts              Dated moments the clock can be set to, found as roots on the orbits
        earth-view.ts          The view from Earth: the centre's rules and each body's path seen from Earth
        young-sun.ts           The faint young Sun along the timeline, on the shared law (src/space/sun/model)
        views.ts               The default view and the playing clock's speed-up by scale
        tour.ts                Guide steps and their flights
        catalogue/             The timeline's figures: value or span, unit, source, status
        solar-activity*.ts     The Sun's illustrative Hα activity: where the shared hedgerow
                               prominence (src/space/sun/graphics/prominence) stands, each
                               region's slow cycle of flows and eruption
        parameters.ts, equations.ts, model-check.ts
      lib/graphics/            The time-dependent sky (sky.ts, on the shared band and star points in src/space/sky),
                               tour-sketch.ts, shaders/ (the WebP map loader is
                               @horizon/toolkit/scene; MAP_BASE is src/space/solar-system/graphics/maps.ts)
      lib/scene/               The engine: engine.ts hosts the shared solar system on the
                               toolkit's scene host, orbit rig and controls, moves it along
                               the timeline and adds what is the Orrery's own: the sky
                               (sky-layer.ts, with the natal cloud's collapse),
                               close-ups of Earth's observatories at their true size (the
                               shared solar close-up, src/space/solar-system/scene/close-up.ts,
                               draws Earth below one in a depth pass of its own),
                               streamed measured maps (measured-maps.ts: each body waits in
                               its map's mean colour, then fades it in), the view from Earth
                               (earth-view.ts: the aim rides Earth, trails of the paths seen
                               from it), the faint young Sun (young-sun.ts: the glow by its
                               output, the habitable zone band), the guide, solar activity,
                               picking and the HUD
      lib/store.ts             Zustand store (orrery namespace messages)
    deep-field/
      index.ts                 Public client entry: DeepFieldApp
      manifest.ts, routing.ts, server.ts, technical.ts
      bench.ts                 Headless benchmark target: the engine on its store (src/space/bench.ts)
      components/              Overlay, depth ladder, sightline, guide caption, the Objects
                               and Settings panels, cards, canvas host
      lib/model/               Deep Field's own, without three.js scenes; the worlds it draws
                               are the shared ones (src/space/galaxy, cosmos, the solar system
                               and its reach):
        view-ids.ts, views.ts  The fifteen views, inner planets to the observable universe,
                               and how each one's distances are known (METHOD_OF)
        depth.ts               The ladder's log scale and the sightline (distance,
                               light-travel time, redshift, Earth when the light set out)
        tour.ts                The guided journey, planets to the first light: its shots
        equations.ts           The formulas technical.ts prints, gathered from the worlds
        catalogue/             The shared catalogues composed as the cards read them, and the
                               figures the technical notes quote (PROSE_FIGURES)
      lib/graphics/looks.ts    The bright-star sky's points and the shared worlds' looks on one
                               brush (src/space/brush.ts)
      lib/scene/               The engine: the shared solar system held at today (each body's
                               map painted once the body is drawn), then the
                               reach, the nearest stars, the Galaxy and the cosmic map (the
                               shared layers) on the toolkit's scene pieces, with Deep Field's
                               own sky layer, picking and HUD; camera-rig.ts turns the orbit
                               rig's frame and aim between the scales, guide-director.ts flies
                               the journey on the toolkit's tour camera (as the Orrery's guide
                               does); kit.ts holds the label insets and the solar switches
      lib/store.ts             Zustand store (deepField namespace messages); its switches and
                               selection are the shared worlds' (src/space/galaxy/show.ts)
    spectroscopy/
      index.ts                 Public client entry: SpectroscopyApp
      manifest.ts, routing.ts, server.ts, technical.ts
      components/              The stage (scene canvas and spectrum), dock, line card with its
                               level diagram and curves, Elements and Display panels, guide;
                               spectrum-view/ keeps the ribbon, plot, labels and gestures as
                               hooks and pure helpers beside the component
      lib/scene/               The scene canvas's layout, still-scene painters and photon flock
      lib/model/               The physics, without React or the DOM:
        atoms.ts               Elements, NIST lines and partition functions (atomic-data.json
                               from scripts/fetch-atomic-data.mjs)
        atmospheres.ts         ATLAS9 photospheres (atmospheres.json from
                               scripts/fetch-model-atmospheres.mjs, which picks each star's
                               model by the shared catalogue's gravity, `logSurfaceGravity`)
        populations.ts         Saha and Boltzmann
        profile.ts, voigt.ts   Line shapes: Doppler, Voigt, hydrogen collisions (broadening.json
                               from scripts/fetch-line-broadening.mjs), Stark
        continuum.ts           The stars' continuous opacity: H⁻, hydrogen, scattering
        spectrum.ts            The synthesis entry point, stars' layered LTE transfer, line
                               reports and curves of growth; spectrum/slab.ts the bench's
                               uniform gas, spectrum/radiance.ts their shared source light,
                               spectrum/types.ts the observation and detector contracts
        spectrum/sampling.ts   The shared grid in ln λ, its cached chunks, Earth's air and the
                               instrument's pixels. Each source is worked out in its own frame,
                               so a pan, a zoom or a velocity reuses what it has met and only a
                               new source starts afresh
        telluric.ts            Earth's O₂ A and B bands
        scenes.ts, stars.ts    What each view observes: bench, named stars, mysteries; the
                               settings' ranges and defaults
        glow.ts                A glowing gas's colour and brightness, for the scene
        equations.ts, tour.ts  The formulas the documents print; the guided journey
      lib/synthesis.ts         Spectra and mysteries' answers off the main thread, on one
                               toolkit worker task held while a view is open, freed after the
                               lab is left (synthesis.worker.ts, model/jobs.ts): each
                               view's latest request wins and its first is drawn in place, a
                               mystery runs one spectrum per step (with everything, then
                               without each element) with other spectra answered between
                               them; with no Worker (Node's tests) the same pure function
                               runs on the page
      lib/store.ts             Zustand store (spectroscopy namespace messages)
    giants/
      index.ts                 Public client entry: GiantsApp
      manifest.ts, routing.ts, server.ts, technical.ts
      components/              Canvas with the bodies' names, overlay, dock (the ladder as a
                               slider, the ruler), card with light circling at true speed,
                               Bodies and Display panels, guide
      lib/model/               The ladder, without React or WebGL:
        rungs.ts               The bodies in order of size, neutron star to TON 618; kind, fate
        catalogue.ts           Every card figure: the measured ones from src/space/stellar.ts and
                               what follows from them (luminosity, horizon, light's lap, density)
        physics.ts, equations.ts
                               Convection cells, light's lap, density words over the toolkit's
                               Stefan–Boltzmann, scale height and mean density; the formulas
                               the documents print
        ladder.ts              Bodies side by side on one horizon; the camera's place `t`, its
                               scale and the zoom about the smaller body between two rungs
        ruler.ts, tour.ts      The ruler's round length and unit; the guided climb
        overview.ts            Every body at once: each at its radius on a log axis, one row
                               apiece; the glide there from the ladder; the scale lines in the
                               ruler's units
        looks.ts               Each body's surface: style, pole and equator temperatures,
                               convection cells, haze, pulsation, weather kind, display spin
        activity.ts            A star's weather as a function of its seed and the time: active
                               regions, flares, prominences, post-flare loops, ejections
      lib/graphics/            giants.frag.glsl: every body a ray-traced globe in one pass
                               (Earth and Jupiter from their measured maps, horizons, orbits,
                               the tone curve); surface.glsl the stars' faces (Planck colour,
                               grey-atmosphere limb, convection, spots, faculae, pulsation);
                               weather.glsl beyond the limb (winds, corona, chromosphere,
                               prominences, loops, ejections); hole.glsl a black hole's
                               horizon and its photon ring at the shadow's edge, to scale; the
                               noise, convection, Planck, tone curve and display encode are
                               toolkit snippets; tints.ts each body's glow colours, worked out
                               once per rung into a small texture; weather-uniforms.ts and
                               vectors.ts what the frame writes to the pass; dots.ts the
                               overview's flat dots, every body in one small texture
      lib/engine.ts            The camera, drift and frame orchestration; graphics/renderer.ts
                               owns the shader passes, uniforms and map loading; input.ts the
                               wheel, drag, tap and keys; labels.ts the body and orbit names
      lib/store.ts             Zustand store (giants namespace messages)
      bench.ts                 Headless benchmark target: the engine on its store (src/space/bench.ts)
    sun/
      index.ts                 Public client entry: SunApp
      manifest.ts, routing.ts, server.ts, technical.ts
      components/              Canvas (the scene's names), overlay, dock (the places in view, the
                               light, the clock, the view's own slider: the cut, the eruption, the
                               cycle; Parker's readout), the Places finder and Settings panels, the
                               place card, guide
      lib/model/               The lab's own, without WebGL: views.ts (the eight views and what
                               each opens with), lights.ts (the dial's ids), clock.ts (the rates),
                               places.ts (what the finder lists), tour.ts (the guided journey),
                               stages.ts (the eruption's and the cycle's stages);
                               the Sun's physics is the shared src/space/sun
      lib/scene/               The engine on the toolkit's scene host (engine.ts) and the store's
                               side of it (bridge.ts, settings.ts): the globe ray-traced on a
                               proxy sphere with its cut (globe-layer.ts, the measured map
                               sun-map.ts), the atmosphere beyond the limb (atmosphere-layer.ts),
                               the field's ribbons (field-layer.ts), the shared prominence volume
                               placed (prominence-layer.ts), Parker on its orbit and at its true
                               size (parker-layer.ts), the sky turned into the Sun's frame
                               (sky-layer.ts, sky-frame.ts), the uniforms they share (looks.ts),
                               a light's dissolve (dissolve.ts); the camera (camera-rig.ts) on the
                               eight framings (views.ts, framing.ts), the names at their anchors
                               (names.ts, anchors.ts), the taps (picking.ts), the wedge's motion
                               (cut-motion.ts), the engine's hooks and readouts (types.ts);
                               lib/graphics/ its GLSL and light tables;
                               lib/parameters.ts its numbers and shader header;
                               lib/quality.ts its budgets by render level
      lib/store.ts             Zustand store (sun namespace messages); lib/drift.ts the drift
      bench.ts                 Headless benchmark target: the engine on its store (src/space/bench.ts)
    voyage/
      index.ts                 Public client entry: VoyageApp
      manifest.ts, routing.ts, server.ts, technical.ts
      components/              Overlay, the flight dock (clocks, hold, rate, drive), the Objects
                               and Settings panels, cards, guide caption, canvas host
      lib/model/               The ship and its world:
        parameters.ts          Drives (Voyager, light sail, one-g torch), clock rates, floors
        relativity.ts, ship.ts Trip times on both clocks; the ship's state and its integrator
                               on proper velocity (four-acceleration, rapidity)
        bodies.ts              Where every body is in km, doubles, barycentres resolved
                               (the shared solar model's barycentre.ts)
        anchors.ts             Every destination: bodies, α Centauri, the Galaxy from above,
                               Andromeda, the edge of the reachable; the card each opens
        alpha-centauri.ts      α Centauri's three suns from the shared catalogue: B on its
                               visual orbit, Proxima at its place today
        calendar.ts            Earth's calendar held within the JavaScript date's reach
        comoving.ts            The expansion with the clocks (a held inside the far plane)
                               on the shared rule of what it moves (`expansionFactor` in
                               src/space/cosmos), the background's temperature
        places.ts, view-ids.ts The places the address names; tour.ts the guided journey
        assist.ts, gravity.ts, autopilot.ts, regime.ts
                               Flying by hand: the warp, the wells; the autopilot's schedule;
                               the speed regimes
      lib/scene/               The engine on the toolkit's host with a logarithmic depth
                               buffer: the ship at the origin (floating origin), every body
                               at true size placed by its offset from the ship (bodies-layer.ts,
                               eclipse occluders, rings, orbits), the ship camera parked about a
                               body, flying free on the keys, or on an autopilot flight
                               (ship-camera.ts, with arrival and parking poses in ship-framing.ts
                               and moving gravity wells in ship-environment.ts), the bright stars
                               at their distances and the painted Milky Way with aberration and
                               Doppler colour (stars-layer.ts), α Centauri as discs (alpha-centauri-layer.ts),
                               the shared worlds about the ship (worlds-layer.ts: the reach, the
                               Galaxy and the cosmic map scaled by the expansion), the microwave
                               background's shell centred on the ship (cmb-layer.ts), the map
                               budget streaming tiers by on-screen size (map-budget.ts), the HUD
                               readouts,
                               the cockpit drawn in DOM (cockpit.ts: canopy, velocity markers,
                               the aim's range, a log-scale scanner, the throttle; the geometry
                               in model/instruments.ts), and the optional ship feel (feel.ts: a
                               crash's hold and jolt, the drive's spool-up, the view widening)
      lib/store.ts             Zustand store (voyage namespace messages)
    afterglow/
      index.ts                 Public client entry: AfterglowApp
      manifest.ts, routing.ts, server.ts, technical.ts
      components/              The overlay, the dock (the clock and the worlds over the timeline:
                               the chapters along one horizon line, the playhead a sun under it,
                               dawn where time slows), the world card, the atlas (the inner orbits
                               from above, the HR diagram), the Settings panel, the guide caption
                               with its crossings
      lib/model/               The Sun's life, without WebGL:
        track.ts               The evolutionary track as a sparse, sourced table (age, light,
                               temperature, mass): Schröder & Smith 2008 from the ZAMS to the AGB
                               tip, a drawn climb between their rows, Miller Bertolami 2016 for the
                               crossing to the nebula, the Montreal 0.5 M☉ cooling sequence for the
                               dwarf; log-linear interpolation, on a logarithmic clock after the
                               envelope leaves
        sun.ts                 The Sun at an age: the radius by Stefan–Boltzmann, the surface
                               gravity, the habitable zone (the shared src/space/sun/model/young-sun),
                               the spectrum's peak
        worlds.ts              The worlds to stand on and the planets the giant reaches: orbits from
                               the JPL elements, widened as the Sun loses mass (a ∝ 1/M); sunlight,
                               the Sun's width and the period from the laws; a planet's fate (Earth's
                               the tides', Schröder & Smith, marked uncertain)
        chapters.ts            The chapters as the clock's dilation: cells of the track per chapter,
                               the slider both ways, the play rate and the paces
        pacing.ts              The tempo: playback slows where the Sun's radius and temperature
                               rush (eased in, released within the rush), the playback step, the life's seconds
        framing.ts             The Sun's frame: the disc's share from its radius, whichever world
        flight.ts              Where the camera stands over a world, and a flight between
                               worlds: pull back under the Sun, cross, come in
        oceans.ts              Earth's oceans going between the moist- and runaway-greenhouse
                               limits (Kasting et al. 1993), the dry map's blend
        vantage.ts, tour.ts    The autoplay's schedule of worlds; the guided journey
        catalogue.ts           The prose figures the copy quotes and the track's rows for the ledger
        equations.ts           The formulas (the radius from L and T, the orbit's widening, the
                               period about a lighter Sun, sunlight, the angular size)
        parameters.ts          The clock's pace, the world changes, the orbit the view is taken from, where
                               the Sun stands in the view, the display's exposure, the shader header
        display.ts             The display's exposure: one law for the globe's day side and the Sun
      lib/graphics/            looks.ts: the sky's and the Sun's uniforms, the shared continuum and
                               limb tables as textures; shaders/: sky.frag (space, a point Sun's
                               halo, the nebula's glow), star.vert/frag (the photosphere: the shared
                               continuum, limb and granulation), the view include
      lib/scene/               engine.ts on the toolkit's scene host: the sky pass, the shared bright
                               stars and field (src/space/bright-stars, sky/milky-way), the world's
                               globe by the shared solar close-up (src/space/solar-system/scene/
                               close-up: its measured map, atmosphere shell and depth pass) lit by
                               the Sun's colour and strength, the Sun's globe in a magnified pass of
                               its own; the clock (playing at the chapter's pace and the tempo,
                               easing to an aim), the world changes (a flight that pulls back
                               and comes in, model/flight.ts, as the clock runs or a world is
                               chosen; on a scrub veil.ts's still dissolves into the new; the
                               clock hushed either way), the view (look-input.ts: drag, wheel, pinch, keys, eased
                               to its aim) clamped so the Sun and the limb stay in frame, the
                               HUD's clock
      lib/store.ts             Zustand store (afterglow namespace messages); lib/drift.ts the autoplay
                               (one track held, the life from the start at half pace)
  lib/
    sources.ts                 Shared bibliography the catalogue figures cite
    facts.ts                   Catalogue fact and card-spec types, and their printers
    year-span.ts               A span of years in the unit that fits and its rounding (Orrery,
                               Deep Field, Afterglow); each lab words its own sentences
    scene-store.ts             Every simulation's render settings and their setters
                               (`renderSlice`), what a zoomable scene's store shares
                               (`sceneSlice`), the guide machine of every stepped guide
                               (`guideSlice`) and `asideOpen`
    help.ts                    The `?` tour's machine every store carries (`helpSlice`): steps of
                               `data-coach` targets and cues, the snapshot it gives back
    scene-bridge.ts            An engine's side of that store: turns, flights, ready, the HUD
                               readouts it publishes (`createSceneHud`), what the HUD publishes
                               on the stage (`stageClearance`), redraws on a motion-preference
                               change and the camera's side of the Orrery–Deep Field crossing
                               (`bridgeHandoff`); the camera an engine lends the store
                               (`lendCamera`, `orbitCamera`: `SceneCamera`)
    handoff.ts                 One-shot note that a visitor crossed between two simulations
                               that show the solar system (manifest `solarSystem`) at a view,
                               with the camera's pose, so the other side opens where this one
                               left off
    simulation-types.ts        Registry contract
    simulation-paths.ts        Shared `/lab` prefix, path helpers and preset slug routes
    simulations.ts             Registry and active-app matching
    redirects.ts               Native Next.js compatibility redirects
    metadata.ts                Page metadata: pageMetadata, simulationMetadata, localeParam
    credits.ts                 Imagery, data, font and package credits for /credits
    changelog.ts               Reads and parses /changelog's Markdown (content/changelog)
  space/                       Shared astronomy for the shell, catalogue and simulations:
    messages/                  The shared copy (units, distance words, HUD chrome, the solar
                               system's names), merged under each one's namespace (messages.ts)
    star-catalogue.ts           Shared bright-star positions, magnitudes and colours
    star-distances.ts          Their distances: stellar.ts's for the stars it describes, else
                               SIMBAD's (star-distances.json, from scripts/fetch-star-distances.mjs)
    stellar.ts                 Measured radii, masses, temperatures, light, distances, tilts and
                               radial velocities of named stars, remnants and black holes, each
                               with its source
    solar-composition.ts       The Sun's photospheric abundances and hydrogen mass fraction
    observer-sky.ts             Observer location and apparent Sun, Moon and star positions
    bright-stars.ts            The catalogue's bright stars on the sky sphere, as points
                               carried with the camera (`createBrightSky`, `carrySky`)
    sky/                       The Milky Way as the sky shows it: the painted band in galactic
                               coordinates, its grains and a faint field (`createMilkyWay`),
                               drawn by the Orrery along its timeline and by Voyage from the ship;
                               band.ts paints the maps and grains on a worker (band.worker.ts),
                               the last sky per set of eras kept for the next mount
    sun/model/                 The Sun's shared laws: the faint young Sun's output and habitable
                               zone (young-sun.ts: Orrery, Afterglow) and the granules' size
                               (granulation.ts: Giants, Afterglow)
    sun/graphics/              The Sun as any host draws it: the CIE/Planck continuum and Claret
                               limb tables (atmosphere.ts, limb-grid.json, spectrum-sample.ts),
                               the GLSL Giants and the Sun lab share (shaders/: continuum,
                               sampling, granulation, spots) with its own header (shader-defines.ts)
                               and the numbers both draw the surface with (parameters.ts), and
                               the hedgerow prominence volume (prominence/: the bake on a worker,
                               its bounds' geometry, the two shaders) the Orrery and the Sun lab
                               both place
    bench.ts                   A scene engine on the bench: its frame loop driven frame by frame
    quality.ts                 What a render quality means for every space scene: tier,
                               resolution, swarms, the sky's points, the bloom chain, the lens's star
    brush.ts                   What the worlds' looks paint with, once per engine: a soft glow,
                               a soft point, the touch targets' invisible material
    solar-system/              The solar system at any moment, for any host engine:
      model/                   parameters, equations, moment (migration, growth, the gas
                               disk), formation (the core's free fall, the protostar), history (Saturn's rings across their dated window, the Moon's distance by the tidal records),
                               elements, tracers, catalogue, views (and the solar
                               framing every host engine shares), framing (and the radii an
                               arrival frames), position, moon-orbits (the moons' orbits, the
                               Moon from the toolkit's lunar theory, without three.js),
                               barycentre (a planet's centre beside its system's: the
                               Earth–Moon and Pluto–Charon offsets); its reach:
                               probes.ts (five probes on their JPL Horizons tracks,
                               probe-tracks.json from scripts/fetch-probe-tracks.mjs, the
                               heliopause they crossed, sunlight's light-time rings) and
                               probes-catalogue.ts (the Voyagers' crossings); near Earth:
                               observatories.ts (Hubble and Chandra on CelesTrak elements
                               turned by J2, Webb on its Horizons track about L2,
                               observatory-orbits.json from
                               scripts/fetch-observatory-orbits.mjs) and
                               observatories-catalogue.ts
      graphics/                looks.ts (the Sun's place and the eclipse slots a host may
                               write), swarms.ts and tracers.ts (small bodies moved on the GPU;
                               shaders/kepler.glsl places them, drift-epoch.ts re-bases their
                               along-orbit drift in time), moons.ts, shader-defines.ts, shaders/,
                               maps.ts (MAP_BASE) and map-tiers.ts (tiers by on-screen size);
                               reach-looks.ts (the probes' glow and the wind bubble)
      scene/                   solar-system.ts composes the Sun, planets, moons, populations
                               and the reticle (*-layer.ts, focus-ring.ts) on a kit (kit.ts)
                               with its own level of detail (lod.ts); reach-layer.ts draws the
                               reach on a host's kit; observatories-layer.ts draws Earth's
                               observatories (markers, orbits, models) where Earth's system
                               is at its true scale; close-up.ts flies to a body (or an
                               observatory) at its true size for any host, with its detailed
                               map, atmosphere shell and depth pass (close-up-framing.ts: the
                               moon framing; model/close-up.ts: what can be flown to, Back's
                               level, the rig's bounds)
      format.ts                Names and orbit rows both simulations print
      cards.ts                 The figures the population cards quote (`POPULATION_FIGURES`)
    galaxy/                    The Galaxy and the nearest stars, today, for any host engine:
      show.ts                  What the worlds beyond the solar system draw with: the realm,
                               the switches (GalaxyShow), the selection (WorldSelection) and
                               the frame (WorldFrame) a host's store composes
      model/                   parameters, equations (the Sun's epicycles, the arms, the warp),
                               galactic-orbit (the Sun's place and its recent path),
                               neighbours (nearest stars and their closest approaches, Gaia
                               astrometry), catalogue/ (the Galaxy's and the stars' figures)
      graphics/                galaxy.ts (today's spiral as point clouds), looks.ts
      scene/                   frames.ts (one world in au: the galactic and supergalactic
                               frames, LY and MLY, galaxyToWorld, the scale blends and
                               realmOf), lod.ts (faders, screen scale and the blends, per
                               frame), kit.ts, label-picks.ts (what a tap on a name opens),
                               galaxy-layer.ts and neighbours-layer.ts
    cosmos/                    The cosmic map beyond the Galaxy, for any host engine:
      model/                   cosmos.ts (named galaxies and clusters at today's places, the
                               observable universe, camera aims), catalogue.ts
      graphics/                cosmos.ts (the sampled clouds, web and far field), looks.ts
      scene/                   cosmos-layer.ts fades what cosmos-clouds.ts draws,
                               cosmos-rings.ts and cosmos-marks.ts, in the Galaxy's pass
  content/changelog/           The change log, one Markdown file per language (<locale>.md)
  i18n/                        Shared request/routing/navigation configuration
  messages/                    Shared catalogue and shell copy; status/ the error and
                               404 copy, merged in, that the root pages bundle alone
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
  src/worker/                  Pure computations on a module worker, in place where none starts;
                               errors per request, long ones in steps between newer requests
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
to the feature root through data attributes (every stage marks its canvas
`data-simulation-canvas="<slug>"`), never translated accessible labels or a global selector. Feature CSS is scoped to that same root. The shared stage
fits the remaining viewport below the header; the catalogue retains normal
page scrolling.

## Routes and compatibility

| Route                       | Purpose                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | Catalogue                                                                                                                                    |
| `/lab/black-hole`           | Default black-hole scene                                                                                                                     |
| `/lab/black-hole/m87`       | Preset                                                                                                                                       |
| `/m87`                      | Permanent redirect to the preset route                                                                                                       |
| `/lensed`                   | Permanent redirect to the default scene                                                                                                      |
| `/lab/orrery`               | Orrery, default view (the giant planets)                                                                                                     |
| `/lab/orrery/oort`          | Orrery view (inner, kuiper, scattered, oort)                                                                                                 |
| `/lab/orrery/oort-cloud`    | Permanent redirect to the canonical view                                                                                                     |
| `/lab/deep-field`           | Deep Field, default view (the Milky Way)                                                                                                     |
| `/lab/deep-field/laniakea`  | Deep Field view (heliosphere, stars, local-group, local-sheet, virgo-cluster, virgo-supercluster, laniakea, cosmic-web, observable-universe) |
| `/lab/spectroscopy`         | Stellar Spectra, default view (the Sun)                                                                                                      |
| `/lab/spectroscopy/stars`   | Stellar Spectra view (kirchhoff, stars, mystery)                                                                                             |
| `/lab/giants`               | Giants, the Sun in focus (behind the `giants` feature switch, released: on)                                                                  |
| `/lab/giants/betelgeuse`    | Giants with that body in focus (every rung in `rungs.ts`)                                                                                    |
| `/lab/sun`                  | The Sun, its surface (behind the `sun` feature switch, released: on)                                                                         |
| `/lab/sun/eruption`         | The Sun's view (inside, sunspot, chromosphere, corona, eruption, cycle)                                                                      |
| `/experience/voyage`        | Voyage, default place (Earth)                                                                                                                |
| `/experience/voyage/saturn` | Voyage place (earth, moon, mars, jupiter, saturn, pluto, stars, galaxy, andromeda, edge)                                                     |
| `/experience/afterglow`     | Afterglow, today's chapter (behind the `afterglow` feature switch, released: on)                                                             |
| `/experience/afterglow/tip` | Afterglow chapter (young, today, oceans, subgiant, tip, flash, pulses, nebula, dwarf)                                                        |
| `/black-hole/...`           | Permanent redirect to the same `/lab` page (pre-prefix URL)                                                                                  |
| `/orrery/...`               | Permanent redirect to the same `/lab` page (pre-prefix URL)                                                                                  |
| `/en/...`, `/cs/...`        | Served in that language, then shown as the clean path                                                                                        |

A simulation is a lab or an experience (the manifest's `kind`). Labs, the
catalogue's primary shelf, live under `SIMULATION_PREFIX` (`/lab`); experiences,
its quieter second shelf (less to learn, more to sit back in), under
`EXPERIENCE_PREFIX` (`/experience`), both in `src/lib/simulation-paths.ts`. Build
manifest paths with `simulationPath(slug)` or `experiencePath(slug)`; the route
type rejects other prefixes. `labs` and `experiences` (`src/lib/simulations.ts`)
are the catalogue's and the phone menu's two shelves. Redirects go straight to the
canonical page, never through a chain.

URLs never carry the language. Pages are still prerendered under an internal
`[locale]` segment (`/en/...`, `/cs/...`). Static `afterFiles` rewrites in
`src/lib/redirects.ts` serve a clean path from the `cs` pages when the `NEXT_LOCALE`
cookie is `cs`, and from the `en` pages otherwise. Old `/en` and `/cs` links still
serve their prerendered page. `LocaleUrl` in the locale layout then sets or clears
the cookie and replaces the address with the clean path. Next.js does not send
config headers with redirect responses, so a redirect could not set the cookie.

Each manifest has a serializable `routes` descriptor, constructed with `defineRoutes`
(`src/lib/simulation-paths.ts`): base path, App Router parameter name, default ID,
ordered entries, aliases and any historical base paths. The entries come from the
feature's lightweight definitions. `routing.ts` passes that descriptor to `slugRoutes`
to expose resolution, canonical paths and static parameters. The sitemap iterates the
enabled manifests; it has no second list of simulations. Definition-time validation
rejects duplicate IDs, ambiguous aliases, missing defaults and unknown alias targets.
Slugs are normalized lowercase letters and numbers with hyphens or underscores; dot
segments, spaces, URL escapes and route-pattern syntax are rejected. Canonical paths
encode Unicode IDs, and browser path resolution decodes them once. Static parameters
keep the original IDs, as Next.js expects.

`defineSimulation` (`src/lib/simulation-manifest.ts`) constructs the manifest from its
descriptor and catalogue details. It derives `href` from `routes.base`, artwork and social
image paths from the feature ID, and entry-point URLs from their declared `view` IDs.
Returned entry points expose only `id` and `href`; their input-only `view` is not part of
the public type. Compiler-checked contracts in `tests/types/` protect this transformation.
The English `socialSubtitle` belongs to the manifest; `scripts/generate-social-assets.mjs`
iterates the registry to generate every feature's image, including disabled features.
There is no separate asset registry or hand-maintained list in the image generator.

`src/lib/redirects.ts` consumes these descriptors and their declared compatibility paths. Next.js
serves these redirects before rendering, preserving query strings automatically. Redirect
source slugs are encoded like browser request paths, including historical Unicode aliases;
encoded canonical paths are excluded so they cannot redirect to themselves.
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

Long-form page content is written once per language as Markdown rather than as message keys.
The change log is the first: `src/content/changelog/<locale>.md`, read when `/changelog` is
prerendered and parsed by `src/lib/changelog.ts`, whose header documents the part of Markdown
it accepts (dated releases, groups, changes with details, `**strong**` and `code`); any other
line fails the build. The page's kicker, title and lead stay in the message catalogs. A test
holds the languages to the same releases, groups and counts of changes.

Theme state belongs to the shared provider/header. Features consume semantic
UI tokens; space canvases use invariant `space` colors. Do not add another theme
or language switch inside each feature. All navigation uses the localized
helpers from `@/i18n/navigation`.

## Adding a simulation

1. Create `src/features/<slug>/` with its private components, state, data, styles,
   and messages. Export the entry component separately from server helpers.
2. Add a serializable `manifest.ts` using `defineSimulation`, with a stable ID,
   kind, message key, English social-image subtitle, highlight keys, and entry points
   (`{ id, view }`, an empty list is fine). Include a `routes: defineRoutes(...)` descriptor
   using the feature's ordered definitions; its `base` comes from `simulationPath(slug)`
   or `experiencePath(slug)`, and `param` names the App Router segment. Put the artwork
   at `public/simulations/<id>.svg`; the generator writes its share image to
   `public/simulations/<id>/og.png`. For parallax on the catalogue tile, wrap the artwork's
   depth bands in `<g class="layer" id="layer-<id>">` groups (contiguous, in paint order, plus the
   SVG's `:target` style) and list them with their depths in `artworkLayers`. Never import the renderer into a manifest.
3. Register the manifest in `src/lib/simulations.ts`. A simulation not ready for
   production names a `feature` switch (`FEATURES` in `src/config.ts`, on only in
   development with the debug tools on, or by `NEXT_PUBLIC_FEATURE_<ID>`): off, it
   is out of the catalogue and the sitemap and its routes are not found. Declare the switch
   only in the manifest. `simulationOn` and `simulationStaticParams`
   (`src/lib/simulation-access.ts`) apply it to discovery and static generation; the shared
   layout and metadata adapters check it before loading feature messages. Add its catalogue copy to
   both shared locale files under `catalogue.<messageKey>`: `title`, `eyebrow`,
   `category`, a one-sentence `description`, `open`, one short label per
   highlight key, and `entryPoints.<id>.title` for each entry point. The
   catalogue tile and header then pick it up automatically; keep the copy short.
4. Add `[locale]/lab/<slug>/layout.tsx` and `page.tsx` (`[locale]/experience/<slug>/`
   for an experience). The layout imports the
   feature's stylesheets and exports `simulationLayout({ manifest, App, messages })`
   (`src/components/simulations/simulation-layout.tsx`), which loads only that feature's
   translations beside the shared ones and keeps the scene mounted across its routes. The
   manifest supplies the feature switch, stylesheet scope (`id`) and namespace (`messageKey`).
   The entry is `simulationClient(namespace, loader)` (`webgl-gate.tsx`): the client-only
   boundary, the loading page and the WebGL check. The root it loads is `SimulationRoot`
   (`src/components/simulations/simulation-root.tsx`) given the store, the view on the address
   (`routing.ts`'s `viewFromPath`), the canvas and the overlay, and the drift
   (`useSimulationDrift`) where the lab has one: it renders the stage with its name, the
   overlay in `SimulationImmersive`, and the loading veil until the first frame.
   Give the overlay's header `SimulationToolbar`
   (`src/components/simulations/simulation-toolbar.tsx`), which keeps every
   simulation's tools in one order and holds the immersive toggle (see
   [Immersive view](#immersive-view)) and the `?` tour (see [Help](#help)).
   The root gives the lab its lifecycle: its store is a module and outlives the page, so
   leaving the simulation puts the store back as it was first made (`useFreshVisit`,
   `src/components/simulations/use-fresh-visit.ts`): no guide still running, no selection,
   panel or switch carried into the next visit; `onLeave` does anything more (new cases
   dealt). Keep any remembered state in the store, not in module variables, so the reset
   reaches it too.
5. Export `simulationMetadata({ manifest, messages })` (`src/lib/metadata.ts`) from
   the page; a `[slug]/page.tsx` also supplies `viewTitle(t, id)`, sets
   `dynamicParams = false`, and exports `generateStaticParams = simulationStaticParams(manifest)`.
   The metadata adapter takes the route parameter, resolution, canonical URL and social
   image from the manifest. Build the feature's client `routing.ts` on
   `slugRoutes(manifest.routes)` so navigation and server adapters share the same definitions.
   Declare `legacy.bases` only when replacing existing URLs; `legacy.rootAliases`
   preserves the black-hole presets' original root addresses.
6. Extend tests for the new feature's entry points and copy coverage. Run
   `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
7. Optionally add `bench.ts` exporting a `benchTarget` so `npm run bench` can time
   and capture the renderer headlessly ([bench/README.md](../bench/README.md)).
   It launches a browser, so run it only when asked.

Automated checks cover catalogue entries, translation parity, routing, namespace
separation, and import boundaries; they do not replace visual and interaction testing.

### Object and view definitions

Giants' `lib/model/rungs.ts` is its ordered membership list. Each entry names a
`BodyRef` (`src/space/body-reference.ts`), its kind, any editorial name or fate, and
illustrative presentation overrides. IDs, scientific inputs, spectral types, energy
sources and names follow that entry. `bodyRecord` (`src/space/body-catalogue.ts`) resolves
the reference against the existing stellar or planetary catalogues inside the model;
it never copies measurements into route metadata. Generic teaching examples may keep
their own feature name while referring to a measured body's figures.

The Sun's view definitions own opening light, clock and action. Deep Field's
`view-definitions.ts` owns order, distance evidence and references to solar or cosmic
framings; `views.ts` resolves those references inside the simulation. Voyage's `PLACES`
owns both route IDs and arrival anchors. Camera functions, shaders and store actions
remain in their runtime modules. Keep definition imports lightweight, including when
read through `next.config.ts`: no renderers, measurements, feature messages or stores.

A destination route may declare `body` and `closeUp: true`. `bodyDestinations`
(`src/lib/body-destinations.ts`) discovers matching addresses among enabled manifests.
Giants' cards use their entries' body references to discover these links; the card owns
its translated hint, with a general hint for a newly exposed lab. This keeps scientific
identity shared while navigation and translated copy stay in the app.

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
  A craft a few metres across is drawn by `createSpacecraftPass` (`src/space/spacecraft`):
  after the host's main pass, in a depth range of its own, placed from the camera by a point
  the host holds exactly (an orbit's aim and the rig's `offset`, a ship); it costs nothing
  until a craft nears a pixel. Deep Field's probes, the Sun lab's Parker and the Orrery's
  observatories fly in with the shared close-up flight (`src/space/close-up-flight.ts`);
  Voyage parks a few metres off.
  `createLabels`, `createTapPicking`, `createAnchoredRulers`, `createDistanceText` and the
  presence helpers serve the layers; `createSceneHud` (`src/lib/scene-bridge.ts`) publishes the scale bar and the nearest
  view a few times a second, plus the feature's own readouts.
- **Store:** `sceneSlice` (`src/lib/scene-store.ts`) gives the shared fields and actions:
  `flight`, `turn`, `ready`, `distanceUnit`, the render settings (`renderSlice`: `quality`,
  `antialias`, `bloom`, `lens`, each with its setter) and the scale bar; the
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
  (things to find; `SolarObjectPicks` lists the solar system's) and **Settings** (how the map
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
  sky; `LensSwitch`: thin diffraction spikes on the brightest compact lights and a colour fringe
  towards the corners; `GlowSwitch`: a soft layer under Stellar Spectra's lights and a halo
  on its ribbon's strong emission lines; `WideColourSwitch`: the canvas in Display P3, offered
  only where the screen shows it (`useWideGamutScreen`, on the toolkit's `WIDE_GAMUT_QUERY`),
  and for WebGL stages where the browser's canvases can switch: Stellar Spectra, the black
  hole and Giants; each off by default in a lab and on in an experience
  (`EXPERIENCE_SCENE_SETTINGS`: an experience shows off), stored like anti-aliasing, and costing nothing while off), an
  optional note and Reset, which puts the panel back as a visit starts (`resetView`; the
  black hole re-applies its preset and turns bloom, the lens and wide colour off). The black
  hole's display step moves its radiance into the canvas's primaries before the tone map, so
  the disk's hottest colours reach past sRGB; Giants does the same before its hue-keeping
  tone map, so its saturated surfaces keep colour sRGB would clip. The Orrery and Deep Field
  offer no wide colour: their materials encode sRGB, so a P3 canvas would only cost a pass. Its copy is the shared `render`
  namespace. Standard is always the default and what the simulation drew before the choice
  existed; what each level and mode does is the simulation's own. `useSceneEscape` lets Escape undo
  one thing at a time.

**Shared worlds.** What more than one simulation draws lives in `src/space/`, below the
features and above the toolkit: it may use app code (`@/lib/facts`, the sources) but never
a feature. It holds the bright-star sky (`brightStarGeometry`) and the solar system as
one unit: `createSolarKit(basics)` and
`createSolarSystem(kit, parent, { place, hideAll, setBodies, rulers })`, drawn each frame at
a `SolarMoment`, with one close-up of a body at its true size (`solar-system/scene/close-up.ts`)
that every host offers alike. The Orrery moves that moment along its timeline and adds Earth's
observatories, its sky and the guide; Deep Field holds it at `TODAY`, adds its reach (`solar-system/scene/reach-layer.ts`:
the probes, the heliopause, light-time rings) and carries on past it into the worlds beyond:
`galaxy/` (the nearest stars and the Galaxy map, with the frames, blends and level of detail
that place every scale in one world in au) and `cosmos/` (the cosmic map out to the microwave
background). Their layers are built on a host's kit (its basics, looks painted on
`src/space/brush.ts`, the world's `Lod`) and draw a `WorldFrame` (`galaxy/show.ts`: the
switches, the selection, the camera distance); a host's store composes `GalaxyShow` and
`WorldSelection` with its own state, and its label picks (`galaxy/scene/label-picks.ts`)
gather what each layer's names open. Their model files import no three.js, so cards and
tests read them as Deep Field's do. The shared copy (names of the solar system, the catalogued stars and holes by their
`stellar.ts` ids, the Galaxy and the cosmos, views, orbit rows, units, HUD chrome) is `src/space/messages/`, merged
under each simulation's namespace by its `server.ts` (`withSpaceMessages`); a key in both is an
error.

The Orrery and Deep Field name the solar system's views alike, and their manifests say so
(`solarSystem: true`). `HandoffLink` resolves the same view through the other manifest's
route descriptor, including its default, and
`src/lib/handoff.ts`, which finds the sides through the registry rather than by name, carries
the camera's pose so it opens where this one left off; neither feature imports the other.

## Afterglow

Afterglow is the Sun's whole life from low orbit over a world, an experience: the globe's limb
curves across the lower part of the view, the timeline in the dock below, the Sun stands low
over the limb, a sunrise, and the world's day side brightens and reddens as the Sun changes
while its night side shows the shared stars. The globe is the shared solar close-up's
(`src/space/solar-system/scene/close-up.ts`): its measured map at true size (every world has
one in the toolkit's `MAPS`: Earth, Mars, Europa, Enceladus, Pluto), its atmosphere shell where
the world has air, its own depth pass, lit by the Sun's colour and visible strength from the
track through the shared surface shader's `sunlight`. The Sun's globe is drawn by the shared
photosphere pieces (`src/space/sun/graphics`): the CIE/Planck continuum at its temperature,
Claret's limb darkening from the shared tables at its temperature and gravity, the shared
granulation at the cells' true count across the radius (`src/space/sun/model/granulation.ts`,
the law Giants also uses), so the giant shows a few huge cells and the dwarf none; beyond the
open view the giant overflows, and inside the photosphere the whole sky is the continuum.
Everything the scene and the cards show follows from one sourced track (`lib/model/track.ts`)
by the laws: the radius by Stefan–Boltzmann, the habitable zone by the shared young-Sun law,
orbits widened as the Sun loses mass with the periods by Kepler, sunlight by the inverse
square, the Sun's width by 2 asin(R/d). A world is swallowed when the radius reaches its
widened orbit (Mercury, then Venus); Earth's widened orbit would escape by that rule, so its
fate is Schröder & Smith's tidal engulfment, flagged uncertain on its card; as the oceans go
between Kasting et al.'s moist and runaway limits a modelled dry map (`scripts/build-dry-earth.mjs`)
blends in over the measured one through the shared planet shader's `later` map.
The chapters are the clock's dilation (`chapters.ts`): each has seconds of its own at the pace
of 1 whatever its length in years (the main sequence a few seconds each, the climb and the tip
the time), and the track's segments are proportional to them; the dwarf's fade runs on a
logarithmic clock. Inside the chapters the tempo (`pacing.ts`) slows the playhead where the
Sun's radius and temperature would change by more than `CHANGE_PER_S` a second, down to
`TEMPO_FLOOR`, widened and smoothed ahead of each rush so it eases in and is back up as the
rush ends (a calm stretch after one never holds the Sun still); a dissolve hushes the clock to
`FADE_TEMPO` and a flight gently to `FLIGHT_TEMPO`, so one thing leads at a time. A visit opens playing from its chapter; a hand
on the timeline pauses it, a look round does not. The Sun is framed, never drawn at true size in
a wide view: the disc spans `DISC_SHARE` of the height at today's radius and grows as its
radius to `DISC_GROWTH`, whichever world it is seen from, so a change reads as one steady
change and a world change leaves the disc as it was; the HUD shows the magnification; the orbit's place on the globe is chosen so the Sun truly stands `SUN_LIFT`
over the limb in the open view, and the magnified pass keeps it at the same place on the
screen, the limb drawn over it. The display's exposure is one law (`display.ts`): every
radiance relative to the light a white surface at Earth's orbit has today, in the display's
bands, shown as its `DAY_GAMMA` root; the eye adapts both ways (the day side held between
`DAY_FLOOR` and `DAY_CEILING`) and to the field it sees (a disc that fills the view sets the
exposure), and the disc's brightest channel is held at `DISC_PEAK`, above the ceiling, so the
Sun is always the brightest thing on screen and keeps its hue, limb and cells; a Sun too small
for its frame is a haloed point. The stars fade with the field's glare; the nebula's shell
lights the night side through the shared surface shader's `skylight`. Each way of playing
has its own camera, one style object read in one place (`model/modes.ts`, `MODES`, the mode
from `modeOf`): the timeline is the visitor's view with a small sway and flights between
worlds; the guide glides (`GLIDE_S`) to each step's shot (`TourStep.shot`: the disc close for
the Sun's figures, the globe for a world's, the sky for the nebula), holds still for reading,
cuts between worlds with a dissolve and gives the visitor's view back as it ends; the drift
opens on the resting view, sways wide and slow on incommensurate periods and flies between
worlds slowly (`DRIFT_FLIGHT_S`). A new mode's sway reach is eased to (`SWAY_EASE_S`) and a
flight calms it through its middle. While the clock runs the globe also turns about its own pole
(`SPIN`, a visual pace, not the world's day), so its surface and air drift past the limb. A flight (`model/flight.ts`, the clock slowed gently by
`flightHush` down to `FLIGHT_TEMPO`) moves like a ship, as one dolly (`along`): it eases out
of the orbit, backs off and closes in at one steady pace in the logarithm of the distance and
eases only into the orbit at the end, so it never slows or turns sharply between: it backs
off the world it leaves while the globe's nearest point slides from the limb's place to a
point low on the Sun's left (`FLIGHT_POINTS`, `standingPlace` turned out of the orbit's plane
by a roll), until the globe is under a pixel (`VANISH_PX`); it crosses with the Sun and the
stars alone (the globes change halfway, `FLIGHT_SWAP`); and it closes on the next world the
same way from a point low on the Sun's right, the globe growing into the limb at rest. The
view's frame faces the Sun as seen from the camera and the Sun's frame follows its law
exactly, so the disc keeps its size.
The readouts name the world drawn (`drawn`, written by the scene as the globes change), its
name spelled out afresh at each change (`TextReveal`), since under a giant every world's night
side and glowing horizon look alike. A scrub
dissolves the old view's last frame into the new over `VANTAGE_FADE_S` instead; the Milky Way is set once to arch across the
resting view (`MILKY_WAY_TILT`). The
timeline sits in the dock under the clock and the worlds (`timeline.tsx`), as the Orrery's
does: the chapters as proportional stretches of one horizon line, named under it as far as the
name fits whole (a short name from the copy on a narrow one), the playhead the brand's sun
under the horizon with the shared `slider-halo` as its corona while the tempo slows, and dawn
over the stretches where time slows; a drag scrubs, a chapter's name goes there; the age is
read once, in the dock beside it. The readouts sit on one glass
chip top left with the chapter's one-line hint. The autoplay (its drift) runs the life from
the start at half pace, the vantage moving outward on the schedule (`vantage.ts`), one track
held. The nebula is drawn from inside its shell as a whole-sky glow lit by the hot core
(`lib/model/nebula.ts`), an illustration the chapter and the technical notes label as such.
The bench decodes the worlds' measured maps before the first frame, as Voyage fetches a
probe's model, so every frame shows the real globe.

## Help

Every simulation's toolbar ends with `?`: a short tour of its controls that does what each
one does instead of dimming the page and pointing; only the HUD around the step quiets, never
the scene. A step rings a control (the toolkit's
`CoachMark`; controls carry `data-coach="<id>"`, the toolbar's tools by their ids, the view
picker as `views`, More as `more` for what phones fold away) and plays its cues on the store:
the camera turns and zooms, a picker opens and a view changes, the clock speeds up, a panel
opens with a layer on. `src/features/<slug>/lib/help.ts` lists the steps (`HelpStep`: `id`,
`targets`, `press`, `cues`), their words are `help.<id>.title` and `.body` in the feature's
messages, or the shared `help.steps.<id>` words (`src/messages`) for the steps every tour has
where the feature's pack says nothing, and the store composes `helpSlice` (`src/lib/help.ts`)
with `save` and `restore` of the fields its cues touch. The camera step and the closing three
(guide, settings, experiences) are `cameraStep` and `closingSteps` of the same module. The slice keeps the panel, the selection and the camera's place
(`SceneCamera.mark`, lent by the engine through `lendCamera`) itself. Starting ends a guided
journey; ending, at any step and however (close, Escape, a press outside, Finish, immersive
view), gives everything back and flies the camera home last. Cues set states outright, so Back
replays a step. Nothing is mounted or listening while the tour is closed.
`tests/help.test.mjs` runs every simulation's tour through its store and checks it moves the
scene and gives it all back.

## Technical documentation

Each simulation should own a `technical.ts` specification (section IDs, equations,
and source references) and localized prose in its feature message namespace.
Reference URLs come from `@horizon/toolkit/urls` so the app and documentation share
the same destinations.
`packages/toolkit/src/ui/technical-details.tsx` renders an already localized
`TechnicalDocument` in a native modal with shared UI tokens; it does not import
feature state or physics. The feature adapter resolves the message keys.
Keep these documents out of the lightweight catalogue manifest.

For black-hole, `npm run docs:generate` produces the feature README from the same
specification, English messages, and preset definitions; `npm run docs:check` detects drift.
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

`UpdateNotice` (`src/components/shell/`) offers a refresh once a newer deployment is live,
never reloading itself. `/version.json` is prerendered with this build's `DEPLOYMENT_ID`
(Vercel's `VERCEL_DEPLOYMENT_ID`, via `next.config.ts`); a visible tab re-reads it on return
and every 15 minutes. Without an ID nothing runs.

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
`interstellar-drift`, `aeolian-static`, `drifting-probe`, `low-drone-rises`, `vast-empty-space`, `the-star-rings` and `the-last-breath`, each as
`.webm` (Opus) and `.m4a` (AAC).
The player owns playback: two streaming decks crossfade for 8 s where a track ends,
the playlist wraps, and Web Audio gains fade play (3 s) and pause (1.5 s). The bed
plays at `MUSIC_LEVEL.ambient` (0.75); a drift lifts it to `MUSIC_LEVEL.drift` (1)
and may hold the playlist on its simulation's track (`useDriftMusic`), never
starting music the visitor has off. The page
preconnects to the CDN; the first track buffers when the toggle is hovered or
focused, or at once when the session had music on. Otherwise nothing loads before
the first play; the next track buffers 30 s before its crossfade, or on
a skip, which blends over 2.5 s. Hidden tabs fade out and resume on return. The
toggle is previous, play or pause, and next; both skips wrap. Playing, the
controls rest and a waveform fills the pill; hover or focus brings them back,
and on a touch screen the first tap wakes them for a few idle seconds. Until sound arrives (the first play, a skip, a
stall), the lens stays half lit and light runs across the waveform. The choice lasts for the browser session;
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

Each track also has an audio map, `audio/<slug>.map.json`, beside it on the CDN: its
loudness and brightness per second, the period it plays before looping and named cues
(rise, quiet, swell, breath, surge, peak, fade), measured by `scripts/analyse-audio.mjs`
(ffmpeg). A drift timed to a track names those cues in its shots (`at`, `land`) and
`timeShots` sets its holds so the flights meet them. The published map is the only one
the page reads: a drift waits for it (and for the track to buffer) behind its loader, and
falls back to the timing it was written with if the map never comes. `bench/fixtures/
audio-maps/` mirrors the maps for the bench and the tests. After a track is re-cut, run
the script and upload the map with it. A drift is a staged piece and begins at its
track's first bar: when the playlist is already on that track, the player restarts it
behind the drift's loader (`restart()`), blending into its intro; a paused drift lets the
music run on, and on resume the camera rejoins at the shot nearest the music.
A guided journey may be timed to a track too. Afterglow's holds the playlist on
`the-last-breath` while it is open (`useDriftMusic`), restarts it at its first bar, and
lands each step on a beat (`JOURNEY_MUSIC` and each step's `beat` in its `tour.ts`): left
to play, the journey plays the Sun's life on to the next step in the seconds left to that
beat (`JourneyTiming` in `guide-caption.tsx`, read from the player's position), and falls
back to the written holds and rides, which add up to the same beats, with the music off.
Tracks live on the CDN as `audio/<slug>.webm` and `.m4a` (see CDN assets). Without
the bucket's CORS headers Web Audio plays silence.

## CDN assets

Large binaries live in the `horizon-cdn` R2 bucket, served from
`cdn.horizonlab.observer` with CORS and one-year immutable caching, not in the
repo. `src/lib/assets.ts` builds their URLs from `CDN_URL` in `src/config.ts`
(`NEXT_PUBLIC_CDN_URL` overrides it), and the locale layout preconnects to the origin. The ignored `cdn/`
folder mirrors the bucket's keys:

- `audio/<slug>.webm`, `.m4a`: the ambient playlist.
- `textures/bodies/<body>/v<version>/<body>-<tier>.webp`: the measured maps (`MAPS_KEY`,
  each body versioned by its `MAPS` entry), written by `scripts/build-planet-maps.mjs`,
  which also prints each far tier's mean colour for that entry (the placeholder while it
  streams). `npm run cdn:pull` fetches the published set, which the map tests check;
  without it they skip.
- `textures/bodies/earth-dry/v<version>/earth-dry-<tier>.webp`: Afterglow's modelled dry
  Earth (`DRY_EARTH_MAP`), written by `scripts/build-dry-earth.mjs`.
- `textures/bodies/sun/spots/v<version>/atlas.png`, `pages.png`: the Sun Lab's close-up spot
  stencil, derived from the Sun's map by `scripts/build-sun-spot-stencil.mjs` (`VERSION`), its
  keys in `spot-stencil.generated.json`.
- `textures/cmb/v<version>/cmb-planck.png`, `cmb-act.png`: the Deep Field's numerical CMB
  maps (keys in `src/space/cosmos/model/data/cmb-source.json`), written by
  `scripts/fetch-cmb-data.mjs` (`VERSION`); see `docs/deep-field-cmb.md`. They load only at
  the observable-universe scale, behind the lab's loading badge.
- `models/spacecraft/<id>/v<version>/<id>.glb`: the probes', Parker Solar Probe's and the
  observatories' models
  (`MODELS_KEY`, each versioned by its `SPACECRAFT` entry in `src/space/spacecraft/models.ts`),
  written by `scripts/build-spacecraft-models.mjs`, which checks each against its entry. A page
  fetches one only as a camera closes on its craft. The bench serves `cdn/` before the bucket,
  so a model built but not yet uploaded renders there.
- `textures/orrery/v1/`: retired, kept for older deployments. Never upload into it.

A published key is never overwritten, so older deployments keep their assets: a rebuilt
map bumps its body's `version` and a new mix takes a new name. Uploading is in
`scripts/README.md`. Keys follow the subject, not the simulation that first used it
(`models/bodies/`), so any feature can share them.

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
    <MyOverlay /> {/* its SimulationToolbar ends with the experiences and help */}
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
of fullscreen). The Black Hole, the Orrery, Deep Field and Giants have one; Stellar
Spectra has no camera, so its experiences button enters immersive view directly.

- `src/lib/drift.ts` holds the shared state (`DriftState`, `driftSlice` for the
  stores: start, pause, resume, toggle, stop, with `open` and `close` hooks for
  what each simulation clears) and the shape of a programme.
- `src/features/<slug>/lib/drift.ts` is the simulation's programme: its music
  (`track` from the playlist, `level`), the camera settings (pace, variance, hold
  orbit and push, order) and the shots. Deep Field's and the Orrery's shots name a
  view plus nudges; the observatory's are poses in M with roll. The Orrery's and
  Deep Field's programmes also visit bodies, and both labs run on the shared visiting
  drift (`createVisitingDrift`, `src/space/drift-visits.ts`: the programme timed to its
  track's map, the framed shots posed by the rig, the visits handed off); a `closeUp` shot
  is a handoff to the feature's close-up, run by the shared visits (the drift
  selects the body, the close-up flies in at `closeUp.pace` times its usual flight
  time with `closeUp.lead` settling the dive onto the body, the visit circles it and
  drifts nearer for the hold, then lets the selection go; before a framed shot the
  close-up's flight out is released to that shot's flight, so the pull away flows on
  and no marker stays: one dive and one pull away per body). The Orrery's hold ends
  pulled out to frame the body with its largest moon; Deep Field visits Voyager 1 from
  the heliosphere and pulls away on the flight to the Oort cloud. The Orrery's `clock` holds the
  playing clock's speed-up to a few hundredths of a year per second while the drift is on,
  so the inner planets and the belt glide rather than whirl; the rate shows under
  the drift's controls (`SimulationImmersive`'s `drift.caption`).
- Giants' camera is a place on the ladder, not an orbit, so its drift is a path of its own
  (`lib/model/drift-path.ts`): one climb that never turns back. Each shot's hold creeps up
  through its body (close enough that its star stays alive); between holds the camera does
  not step by rungs, whose bodies differ in size by anything up to ninety times, but flies
  the smooth zoom and pan between the holds' framings (van Wijk and Nuij), at an even pace as
  the eye sees it. The surface zoom is its one push-in. A climb cannot fly home, so the
  programme's `fade` takes the loop through black on its seam (`seamLight`, the canvas's
  opacity over the stage's black) and the first shot comes out of it at its body. The engine
  runs the path on its own clock; a hand on the camera pauses it, and a pause, a hand or a
  resume eases between the drift's framing and the ladder's along the same smooth zoom. The
  baseline and the orbits fade with the line veil's presence, as the other drifts' lines do.
  As a show piece the drift turns the focus blur and bloom on and gives the visitor's back
  as it ends.
- The toolkit runs the camera: `createDriftRun` from the store's `drift` state,
  and `createRigDrift` on an orbit rig, both with `cut`: a fresh start lands the
  camera on the opening shot behind the loader's curtain (`DriftVeil`, opaque), so
  the first image is the staged shot already in its hold, never a flight away from
  what the visitor was looking at; a resume after a pause flies from where they are.
  An opening shot may carry an `unveil` that plays only on that cut (the dormant
  hole's drift opens on plain stars and pans the warp in; the lit hole's opens on
  its push-in, so the two never feel alike). A director beside each rig engine
  (`lib/scene/drift-director.ts`) resolves the shots to the rig's framings and
  adds what is the simulation's own (the Orrery's and Deep Field's close-up visits); the
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
  `physics` code computes with them, and `technical.ts` references them as
  `{ "equation": "<id>" }` instead of retyping the text. The technical-details
  adapter prints `toString()`; the generated README prints `toLatex()` in math
  blocks. Pass the feature's registry to `SimulationTechnicalDetails`.
- **Model numbers live once.** A model's parameters (the solar system's
  `src/space/solar-system/model/parameters.ts`: Sun's age, galactic year, the young disk…;
  Deep Field's arm pitch and halo) feed both its code and the text of its formulas, which
  are built from them.
- **Figures in copy are arguments, not typed digits**: "One lap in {galacticYearMyr} million
  years". Every one comes from a catalogue: cards through `components/card-specs.ts`, and
  notes, hints, guide and technical prose through the feature's `PROSE_FIGURES` and
  `proseArgs(figures, locale)` (`src/lib/facts.ts`). One formatter prints every figure,
  `formatFigure` in `@horizon/toolkit/science`: a map entry is a fact, or `quoteAs(fact, options)`
  for the way its sentence words it (another unit, other digits, a power of ten for
  "{massMillions} million Suns", scientific notation, ± error, bounds, with its unit). Beside each
  figure goes its plural category as printed, `<name>Plural`, which a word that depends on it
  selects on. Card arguments (`printAll`) and the labs' live readouts (Deep Field's `formatAgo`,
  Voyage's `formatDuration`) pass the same `<name>Plural` / `valuePlural`. The Orrery and Deep
  Field keep their maps in `lib/model/catalogue/`, Voyage, Stellar Spectra and Giants in
  `lib/model/catalogue.ts`, the Black Hole in `lib/figures.ts` (`figureArgs`; `inLine` prints
  the guide's English equation lines) over its own literature figures in `lib/catalogue.ts`
  (`OBSERVATORY`). Pass them to `t()`; for technical prose, pass `figures` (or plain `values`)
  to `SimulationTechnicalDetails`, and for a guided journey to `GuideCaption`.
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
  `technical.ts`.
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
