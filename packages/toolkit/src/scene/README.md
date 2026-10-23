# Scene pieces

Three.js building blocks for a map that zooms across many scales: a host for the
renderer and frame loop, an orbit camera on a log-distance zoom and its input, DOM
labels pinned to scene points, taps that pick objects or names, rulers, HUD readouts,
presence fades, painted sprites, point clouds and the sky's frames. Nothing here knows about a
particular simulation, its store or its copy. Every piece that holds listeners, DOM
nodes or GPU resources of its own takes a `DisposalScope` and is released with it. The
plain makers (`radialSprite`, `softCircle`, `glowSprite`, `paintedTexture`, `spriteMaterial`,
`pointsMaterial`, `lineOf`) hand back what they build for the caller to own.

A new zoomable simulation starts from `createSceneHost`, `createOrbitRig` with
`createViewMoves`, and `createOrbitControls`, places its layers' names with
`createLabels`, and keeps only its layers, its views and how its store is wired of its
own.

## Kit

`SceneBasics` is `{ scope, camera, viewport }`. `viewport` holds the stage's CSS
size; the engine writes it on resize. `SceneKit<Looks, Lod>` is what a scene's layers
are built with: the host's basics, the materials they share and a level of detail with
`pxWorld(dist, px)`, the world size of screen pixels at a distance; `sceneKit(basics, looks,
lod)` makes one. `LabelText` returns translated label text
by key. `SceneMount` is what a page hands an engine: canvas, host element, label
root, label text, the page's `locale` and `onError`. `SOLAR_GOLD` is the theme's
gold for scene materials and `SPACE_BLACK` its space, the clear colour behind every scene;
`cssHex(color)` writes either as `#rrggbb` for the helpers that read CSS hex. `worldPerPixel(fov, distance, height)` is the world length
one CSS pixel covers at `distance` from a perspective camera on a stage `height` px
tall; the scale bar and `createScreenScale` are built on it.

## Host

`createSceneHost(scope, { canvas, host, onError })` makes the WebGL renderer, a `SCENE_FOV` (48°)
perspective camera, the viewport and the engine host (frame loop,
resize, context loss). `tight` marks phones and low-memory devices; `basics` is
`SceneBasics` plus `tight`, `dpr`, the buffer's pixels per CSS pixel as a live
`{ value }` (pass it as a shader uniform so point sizes follow the resolution), and
`invalidate`, which asks for a frame when a layer receives something after it is built
(a texture, a worker's result). `warmUp(scene)`,
called once after the first frame, compiles every material in idle time, hidden objects
included.

`logarithmicDepth: true` makes the renderer with a logarithmic depth buffer, fixed for its
life: depth resolution in proportion to distance, so one pass holds a planet's surface and
the edge of the universe. Every custom shader such a scene draws includes
`<horizon/log-depth>` and calls its two macros; the shared surface shaders do.

`setResolution({ dprCap, fps })` (a `SceneResolution`) resizes the buffer for the next frame;
`resolution` reads it, and the engine caps its frame rate at its `fps`. A host starts at
`defaultSceneResolution(tight)`: 1.5 px per CSS px, or 1.25 at 48 fps on tight devices. The
host knows no quality levels: each simulation maps a `RenderQuality` to a resolution and
its own budgets in its `lib/quality.ts`.

Draw every frame through `render(paint)`: `paint` makes the frame's renders (several
may share a depth buffer, with `autoClear` off and `clearDepth()` between them) and the
host resolves them as `setAntialias(mode)`, `setBloom(bloom)` and `setLens(lens)` last chose, in one
composite pass (`createCompositePass`). The renderer is made without hardware
antialiasing, so a mode switches at once, without a new context: `off` renders straight
to the canvas, `msaa` into a 4× multisampled offscreen frame and `fxaa` through the FXAA
filter. `defaultSceneAntialias(tight)` is the mode a host starts with: MSAA, off on tight
devices. `antialias` reads the current mode. An offscreen frame holds the canvas's own
bytes, so a mode never changes how a scene looks beyond its edges, and needs no second
shader compile.

`setBloom({ enabled, ...settings })` (a `SceneBloom`) switches bloom for the next frame:
on, the frame's bright light is blurred and added back by the composite (`createBloomPass`),
with `DEFAULT_SCENE_BLOOM` for what the call leaves out, in display units (light above 0.6
of white, eased in from 0.3, added back at six tenths through a five-level chain from half
resolution). A simulation's `lib/quality.ts` maps its level and the device class to the
chain's `mips` and `scale` and passes them here; the switch itself is the visitor's, off by
default (`bloom` reads it). `setLens({ enabled, ...settings })` (a `SceneLens`) switches the
lens the same way: on, each compact bright light the bloom's mask holds gets a thin four-point
diffraction star (`createLensPass`), fading out below 0.015 and reaching at most a quarter of
the frame's height, and the corners a colour fringe of 1.5 pixels, with `DEFAULT_SCENE_LENS`
for what the call leaves out. The frame is clipped at white, so lights spike at ten times their
clipped energy, in full from that of the Sun's disc and far less below it (`full`), so a white
speck gets no star. The quality table passes the star's `level` and `reach`. With bloom off,
only the mask levels the lights are found in are built. Only the current mode's and switches' buffers are held. Only what `paint` draws blooms, spikes or fringes: DOM labels and HUD readouts sit above
the canvas, so text never does.

## Orbit rig and controls

`createOrbitRig(camera, options)` holds a pose (azimuth, inclination, distance)
about an aim and moves the distance on the log zoom. `zoomTo` is for input,
`flyTo(distance, angles?)` flies and turns the angles the short way round,
`snap` sets the pose outright, `turnBy` takes a button step (it eases in over about a
third of a second and steps add up; it snaps with reduced motion, and during a turning
flight it carries on to the landing), `spin(azimuth)` turns the azimuth outright and a
flight's turn with it (an orbit riding a turning body), `cancel` lets a flight glide to rest. Each frame call
`step(dt)`, `home()` and `applyPose()`; `offset` is then the camera's exact offset from
`aim`, for placing what stands near a camera whose aim lies far from the origin. Options: the starting `pose`, `limits`,
`reduceMotion` (zooms and flights land at once), `nearFloor`, `far`; hooks `follow`
(another owner holds the distance), `onStep`, `busy`, `home` (where the aim sits) and
`orient` (the orbit's frame for a distance).

`createViewMoves(rig, framing, turns?)` adds `snapToView(id)`, `flyToView(id)` and
`framing(id)` for views given as the pose that frames each. A flight keeps the angles unless `turns(id)`
says the view wants its own; with reduced motion it lands framed as the view is.
`nearestView` and `atViewScale` (in `@horizon/toolkit/camera`) tell which view a
distance is nearest and whether it is still at one.

`createOrbitControls(scope, canvas, rig, { invalidate, distance, dragScale, zoomFloor,
intercept, onInput })` drives the rig from drag, wheel and pinch. Input keeps to `distance`,
widened to the rig's limits wherever they reach further (a close-up's). `dragScale` scales a
drag's turn for the pose it starts from (`ORBIT_DRAG_SENSITIVITY` is the turn per pixel it
scales); `zoomFloor` is the distance wheel and pinch scale toward; `intercept` sees each input first, with its source, and may take it;
`interacting` stays true for a moment after the last one.

## Tour camera

`createTourCamera(rig, { reduceMotion, holdBlocked? })` flies a guided tour: each
`TourShot` is a pose with an optional `flight` (`lift`, `swing`, `lead` and a `duration`
in seconds, 6 by default) and a `drift` for the slow orbit while the shot is read. Call
`step(key, shot, dt)` before the rig steps; a new key starts a flight (`sampleTourFlight`:
the short way round, log-linear in distance), a landed shot drifts until `takeOver()`.
`landed` and `busy` tell the host when to count and when to keep rendering.

## Rig drift

`createRigDrift(rig, shots, settings, { handoff?, attitude? })` runs a drift (`createDriftRun`
in the camera module) on an orbit rig: `step(state, dt, hold?)` writes each
playing frame's pose to the rig and settles it, cancels the rig's own motion as a
flight begins, and gives a handoff shot to `handoff(index, dt, resume)` each
frame until the host resumes the drift from wherever it left the camera. A host that
draws the shots' `look` and `roll` reads them as `attitude` (the rig holds the rest) and
passes its camera's own as the `attitude` option, so a drift starts from the view shown.
`flying` says the drift has the camera now; `landing` is where its flight under way
lands, so a host can fly alongside it (a close-up keeping its body in view on the way out),
and `motion` how it was turning the camera, so a host taking over can carry that on.

## Labels

`createLabels(basics, root, labels, { className, insets })` returns `place`,
`flush`, `hits`, `hideAll` and `setBodies`. Call `place(key, x, y, z, on, style)`
while drawing a frame, then `flush()` once every body has its pose. `on` is a
switch or a presence 0..1; below 2 % a label hides. Text comes from
`labels()[key]` unless `style.text` gives it. Labels never sit inside `insets`
(CSS px kept clear at the top, bottom, left and right: a header, a dock, a side
control; `DEFAULT_INSETS` is 56, 150, 4 and 4, so spread it and override a side).
Pass a function to read them once a frame when the controls over the stage move. Bodies passed to `setBodies` mask the
pixels of a label they cover, at the label's depth; their meshes are unit globes
(geometry within radius 1) scaled by their transforms. `hits(accept)` lists the
labels readable enough to tap. A flush writes every label's content first, reads the
sizes of only those whose text, weight or kind changed (again after a resize or a web
font arriving), then places, masks and moves them: one layout a frame at most.

Labels take the class `scene-label`, styled by `@horizon/toolkit/scene.css` under
an element marked `data-scene-labels`. Import that stylesheet from the routes that
draw a scene, so other pages never load it.

`label-geometry.ts` holds the projections: conservative globe bounds
(`bodyLabelBounds`, into a reused `out`), the depth mask and `labelAt`, the label
nearest a point with a finger's reach. `labelOccluders(bodies, camera, out?)` readies
each globe once a frame; `labelDepthMask(rect, anchor, key, occluders, camera, width,
height, cache?)` then marches only the globes nearer than the anchor whose cone of sight
meets the label's, and with a `labelMaskCache()` returns the same string while the
covered pixels stay the same.

## Taps

`createTapPicking(basics, canvas, options)` reports each tap once, after a press
that moved no more than 6 px; neither finger of a pinch taps. A name tapped squarely wins. Otherwise the
pickables under the pointer give their `userData.pick` (and instance id): the
nearest, or the one `choose(hits, ray)` takes. Then a near miss on a name counts:
44 px on touch (`FINGER_PX`). A small target reaches `TAP_REACH_PX` (half a fingertip) from
its centre, however few pixels it is drawn across. `layers`
adds render layers to the raycast. What a tap means is the caller's.

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
`fadeMaterial(material, opacity)` is the rule for what a faded material draws: it sets the
opacity and skips the material's draws (on every object it is on, each keeping its own
`visible`) while that is under `FAINTEST_OPACITY`, half of one 8-bit step. A layer that fades
through a shader's own uniform, or shrinks a thing by a presence, gates its `visible` by the
same `FAINTEST_OPACITY`.

## Sprites, points and lines

`radialSprite`, `softCircle` and `glowSprite` paint small canvas textures, and
`paintedTexture(width, height, texel)` any sRGB texture texel by texel from a
`TexelPainter` (RGBA 0–255 at `u`, `v` from the top left); `spriteMaterial` and
`pointsMaterial` build additive or covering materials on them. `pointsGeometry(pos, col, size?)` is the vertex-coloured point cloud those
materials draw: `position` and `color` over xyz and rgb triples, and a `size` per
point when given. `createPointWriter(count)` fills one a point at a time:
`put(x, y, z, color, brightness)` writes `color × brightness`, `count` is how
many so far, and `geometry()` views what was written; the buffers grow if a
sketch writes past `count`, so nothing is dropped. `lineOf`, `ownedLine` and
`rulerOf` are reusable line buffers. `ownedOrbitLine(scope, color, opacity, segments = 96)`
draws an orbit as `ownedLine` would (the same basic material, so colour, opacity and the
veil work alike) but the GPU builds its vertices: the geometry (`orbitGeometry(scope,
segments)`) holds static samples, one geometry for every orbit line of a resolution, held
by each line's scope and disposed with the last of them, and `set(shape)` writes a `bodies` `OrbitShape` into three uniforms
(`orbitUniforms`, `writeOrbitUniforms`, read by `<horizon/orbit>`), so a moving orbit costs no
buffer upload. The shape is in the line's own units and frame; the line's scale and place
carry it to the scene's (a floating origin keeps the place relative to the camera). The line
starts and ends at the body, so it meets the body however coarse its segments, and its
samples (`orbitSamples`) tighten towards the body, so it does not kink there seen from close
by, while far from the body they are as fine as `segments` even steps; a material of its own
(Voyage's aberrated orbits) includes `<horizon/orbit>`, spreads `orbitUniforms()` into its
uniforms and draws `orbitGeometry(scope, segments)`. `createLineVeil(seconds = 0.8)` fades a
scene's line art (every `Line`, bar those marked `userData.content = true`, and any
other object marked `userData.annotation = true`, such as a boundary drawn as a
translucent shell) out and back together: `step(dt, shown)` eases its `presence`, `cover(root)` just
before a render scales each line material's opacity (or hides the line once the
veil is down) and `uncover()` right after gives everything back, so the layers'
own visibility and opacity are never disturbed; `busy` asks for frames while it
moves.

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

## Map loader

`fetchMap(url, signal)` fetches a measured map's compressed bytes (a `Blob`, cheap to hold
ahead of need); `decodeMap(blob, anisotropy)` decodes them into a mipmapped sRGB surface
texture off the main thread where the browser allows (`createImageBitmap`, flipped while
decoding), falling back to an image element; `loadMap(url, signal, anisotropy)` does both.
The bitmap stays with the texture so a lost context re-uploads it, and is closed when the
texture is disposed. The app owns where the tiers are served from.

## Floating origin

For a scene that flies from a moon's surface to the edge of the universe, float32 world
positions are coarser than a planet tens of au out. Keep every model position as a `Vec3d`
(three doubles: `vec3d`, `addVec3d`, `subVec3d`, `lengthVec3d`, `distanceVec3d`), keep the
camera at the scene's origin, and place each object by `placeRelative(object, at, viewer)`:
the subtraction happens in doubles before the float write. Point clouds that span the
scene (the sky, the cosmic map) keep their own local origin and are placed the same way.
