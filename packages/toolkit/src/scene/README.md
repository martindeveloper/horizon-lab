# Scene pieces

Three.js building blocks for a map that zooms across many scales: a host for the
renderer and frame loop, an orbit camera on a log-distance zoom and its input, DOM
labels pinned to scene points, taps that pick objects or names, rulers, HUD readouts,
presence fades, painted sprites and the sky's frames. Nothing here knows about a
particular simulation, its store or its copy. Every piece that holds listeners, DOM
nodes or GPU resources of its own takes a `DisposalScope` and is released with it. The
plain makers (`radialSprite`, `softCircle`, `glowSprite`, `spriteMaterial`,
`pointsMaterial`, `lineOf`) hand back what they build for the caller to own.

A new zoomable simulation starts from `createSceneHost`, `createOrbitRig` with
`createViewMoves`, and `createOrbitControls`, places its layers' names with
`createLabels`, and keeps only its layers, its views and how its store is wired of its
own.

## Kit

`SceneBasics` is `{ scope, camera, viewport }`. `viewport` holds the stage's CSS
size; the engine writes it on resize. `LabelText` returns translated label text
by key. `SceneMount` is what a page hands an engine: canvas, host element, label
root, label text, the page's `locale` and `onError`. `SOLAR_GOLD` is the theme's
gold for scene materials.

## Host

`createSceneHost(scope, { canvas, host, onError })` makes the WebGL renderer, a 48°
perspective camera, the viewport and the engine host (frame loop,
resize, context loss). `tight` marks phones and low-memory devices; `basics` is
`SceneBasics` plus `tight` and `dpr`, the buffer's pixels per CSS pixel as a live
`{ value }`: pass it as a shader uniform so point sizes follow the resolution. `warmUp(scene)`,
called once after the first frame, compiles every material in idle time, hidden objects
included.

`setResolution({ dprCap, fps })` (a `SceneResolution`) resizes the buffer for the next frame;
`resolution` reads it, and the engine caps its frame rate at its `fps`. A host starts at
`defaultSceneResolution(tight)`: 1.5 px per CSS px, or 1.25 at 48 fps on tight devices. The
host knows no quality levels: each simulation maps a `RenderQuality` to a resolution and
its own budgets in its `lib/quality.ts`.

Draw every frame through `render(paint)`: `paint` makes the frame's renders (several
may share a depth buffer, with `autoClear` off and `clearDepth()` between them) and the
host anti-aliases them as `setAntialias(mode)` last chose. The renderer is made without
hardware antialiasing, so a mode switches at once, without a new context: `off` renders
straight to the canvas, `msaa` into a 4× multisampled offscreen frame (`createMsaaPass`)
and `fxaa` through `createFxaaPass`. Only the current mode holds buffers.
`defaultSceneAntialias(tight)` is the mode a host starts with: MSAA, off on tight
devices. `antialias` reads the current mode. An offscreen frame holds the canvas's own
bytes, so a mode never changes how a scene looks beyond its edges, and needs no second
shader compile.

## Orbit rig and controls

`createOrbitRig(camera, options)` holds a pose (azimuth, inclination, distance)
about an aim and moves the distance on the log zoom. `zoomTo` is for input,
`flyTo(distance, angles?)` flies and turns the angles the short way round,
`snap` sets the pose outright, `turnBy` takes a button step (it eases in over about a
third of a second and steps add up; it snaps with reduced motion, and during a turning
flight it carries on to the landing), `cancel` lets a flight glide to rest. Each frame call
`step(dt)`, `home()` and `applyPose()`. Options: the starting `pose`, `limits`,
`reduceMotion` (zooms and flights land at once), `nearFloor`, `far`; hooks `follow`
(another owner holds the distance), `onStep`, `busy`, `home` (where the aim sits) and
`orient` (the orbit's frame for a distance).

`createViewMoves(rig, framing, turns?)` adds `snapToView(id)`, `flyToView(id)` and
`framing(id)` for views given as the pose that frames each. A flight keeps the angles unless `turns(id)`
says the view wants its own; with reduced motion it lands framed as the view is.
`nearestView` and `atViewScale` (in `@horizon/toolkit/camera`) tell which view a
distance is nearest and whether it is still at one.

`createOrbitControls(scope, canvas, rig, { invalidate, distance, intercept,
onInput })` drives the rig from drag, wheel and pinch. `intercept` sees each input
first and may take it; `interacting` stays true for a moment after the last one.

## Tour camera

`createTourCamera(rig, { reduceMotion, holdBlocked? })` flies a guided tour: each
`TourShot` is a pose with an optional `flight` (`lift`, `swing`, `lead` and a `duration`
in seconds, 6 by default) and a `drift` for the slow orbit while the shot is read. Call
`step(key, shot, dt)` before the rig steps; a new key starts a flight (`sampleTourFlight`:
the short way round, log-linear in distance), a landed shot drifts until `takeOver()`.
`landed` and `busy` tell the host when to count and when to keep rendering.

## Labels

`createLabels(basics, root, labels, { className, insets })` returns `place`,
`flush`, `hits`, `hideAll` and `setBodies`. Call `place(key, x, y, z, on, style)`
while drawing a frame, then `flush()` once every body has its pose. `on` is a
switch or a presence 0..1; below 2 % a label hides. Text comes from
`labels()[key]` unless `style.text` gives it. Labels never sit inside `insets`
(CSS px kept clear at the top, bottom, left and right: a header, a dock, a side
control; defaults 56, 150, 4 and 4). Pass a function to read them once a frame
when the controls over the stage move. Bodies passed to `setBodies` mask the
pixels of a label they cover, at the label's depth; their meshes are unit globes
(geometry within radius 1) scaled by their transforms. `hits(accept)` lists the
labels readable enough to tap.

Labels take the class `scene-label`, styled by `@horizon/toolkit/scene.css` under
an element marked `data-scene-labels`. Import that stylesheet from the routes that
draw a scene, so other pages never load it.

`label-geometry.ts` holds the projections: conservative globe bounds, the depth
mask and `labelAt`, the label nearest a point with a finger's reach.

## Taps

`createTapPicking(basics, canvas, options)` reports each tap once, after a press
that moved no more than 6 px; neither finger of a pinch taps. A name tapped squarely wins. Otherwise the
pickables under the pointer give their `userData.pick` (and instance id), and
then a near miss on a name counts: 44 px on touch. `layers` adds render layers
to the raycast. What a tap means is the caller's.

## Rulers and distances

`createDistanceText(labels, unit, locale)` formats a distance in au in the
visitor's unit and language, through `formatDistance`. Its words come from the label
keys in `DISTANCE_WORDS` (`au`, `lightYears`, `parsecs`, `lightTime`, `million`,
`billion`).
`createAnchoredRulers(scope, parent, place, { keys, color, pxWorld, distanceText,
world?, prefix? })` keeps one anchor per key for layers to update (`anchor(key)`);
`drawFrom(from, dist)` runs dashed rulers from an anchor, a point or home (the first
key) to every anchor on screen, and `draw` runs one between any two points; `finish()`
hides the rest. Lengths are in `world` units (au by default) and labelled through
`distanceText` in au; labels are keyed `ruler0…`, or `prefix0…` so two sets can share
one label layer.

## Scale bar and readouts

`scaleBar({ fov, dist, width, height, world, choice })` gives a round length
(1, 2 or 5 × 10ⁿ via `niceNumber`) in the visitor's unit, and its length in CSS
px (44–140). For a HUD published a few times a second: `createReadoutClock`
says when, `scaleReadout` gives the bar as a store keeps it, and `scaleChanged`
and `movedBy` keep unchanged values out of the store.

## Presence

`rising(x, from, to)` and `fade(inFrom, inTo, outFrom, outTo)` ease in log
space. `framed(near, far, d)` is the one framing rule for markers and orbits.
`pickLevel` steps between discrete levels with hysteresis. `createFaders()` makes
switches that ease over time: call `begin(dt)` each frame, read `busy` to keep
frames coming. `createScreenScale(camera, viewport)` gives `pxWorld` and `px` for
detail and marker sizes; it counts a stage under 480 px tall as 480, so a small stage
keeps a phone's detail, while `scaleBar` measures the true stage.

## Sprites and lines

`radialSprite`, `softCircle` and `glowSprite` paint small canvas textures;
`spriteMaterial` and `pointsMaterial` build additive or covering materials on
them. `lineOf`, `ownedLine` and `rulerOf` are reusable line buffers.

## Sky frames

`equatorialToScene`, `equatorialFrameToScene`, `poleVector` and `bodyOrientation`
adapt the bodies module's frames to three.js vectors and quaternions.
`GALACTIC_CENTRE`, `GALACTIC_POLE` and `GALACTIC_EAST` are the galactic frame's
axes in the scene.

## Log zoom

`createLogZoom(distance, { limits })` moves a distance in log space: `zoomTo`
for input (a spring, faster for a pinch), `fly(from, to)` for a quintic flight
that leaves at the current speed and lands at rest, `cancel` to glide to rest,
and `settle` after a snap. Call `step(dt, distance, held, clampToLimits)` each
frame. It returns the new distance and, during a flight, its progress, so a
caller can turn angles along with it. A change written by someone else between
steps carries its speed on, unless it was a cut (over half an e-fold). The orbit
rig is built on it. `camera/sampleOrbitFlight` remains the tool for scripted tours
from rest.
