# Camera utilities

All angles are radians. Each scene calls `createCameraSnapshot()` and retains
its own object. `writeCameraSnapshot` updates it without allocating vectors.
No global camera or store is exported.

## Projection contract

`projectWorld(snapshot, x, y, z, width, height, options)` expects an orthonormal
basis: forward into the scene, right, up. Output uses CSS pixels from the top
left. Width and height must describe the same viewport used to construct rays.

It matches this shader convention:

```glsl
vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
vec3 ray = normalize(forward + uv.x * right * tan(fov / 2.0)
                             + uv.y * up * tan(fov / 2.0));
```

Because UV spans ±0.5 vertically, `fov` here is a ray-scale parameter, **not**
the usual full vertical perspective FOV. Do not substitute Three.js projection
without adjusting both sides. The default near-depth cutoff is 0.4 scene units,
label padding is 48 CSS pixels, and viewports smaller than 8 pixels are hidden.
`visible` reports viewport/depth inclusion; it does not perform occlusion tests.

## Orbit and tours

`createOrbitInput(canvas, options)` owns pointer capture, drag, wheel, pinch,
cancellation and listener cleanup. Get/commit poses through callbacks. Distances
and inclination bounds, drag sensitivity, wheel sensitivity and enabled state
are configurable. Wheel deltas are normalized to pixels (16 pixels per line,
canvas height per page, `wheelPixels`) before applying sensitivity. A press that moves
farther than `TAP_SLOP_PX` (6) is a drag, not a tap; the scene's tap picking uses the same. Call `cancel()` when a scripted tour takes control and
`dispose()` on unmount. A pinch does not jump into drag when one finger lifts.

`stepOrbit(pose, turn, options)` applies one discrete button or key step: signed
`turn.azimuth` / `turn.inclination` times `step` (default `ORBIT_STEP`, 15°), with inclination
clamped. Directions match a drag (a positive azimuth turns the scene left). It
snaps, so it needs no reduced-motion branch.

`sampleOrbitFlight(t, from, target)` uses quintic easing. The target's `yaw` is a
signed displacement from the start, not an absolute azimuth; inclination and
distance are absolute targets. Distance eases geometrically, so a push-in zooms
at an even apparent rate. Optional shaping, all zero at both ends: `lift` adds a
mid-flight inclination arc, `swing` a fractional mid-flight distance change, and
`lead` (−1…1) runs the turn ahead of or behind the dolly so the path curves.
Time is normalized [0,1] and t ≥ 1 returns the exact target. There is no
collision, orbital dynamics or automatic shortest-angle selection.

## Flight input

`createFlightInput(canvas, options)` is the pilot's hands for a free-flying camera, modelled on
the orbit input: it owns pointer capture, the wheel, the keyboard and a gamepad, and reports
through callbacks without a camera of its own. A one-pointer drag calls `onLook(dx, dy)` in CSS
pixels; the wheel calls `onWheel(deltaPixels, trackpadPinch)` with the same line/page
normalization as the orbit input and ctrl+wheel as the pinch. Keys write one reusable
`FlightAxes` object (`axes`, never reallocated) and call `onAxes(axes)` on every change: W/S
`thrust`, A/D `strafe`, R/F `lift`, Q/E `roll` (each −1…1, opposed keys cancel), Shift `boost`
(0…1), X `brake` (0…1), Space `park`. Keys are read by `event.code` on the window, only while focus is on the
canvas or inside `stage` (default: the canvas's parent) so a single key never fires from a
form elsewhere on the page (WCAG 2.1.4), never with ctrl, alt or meta held, and only when the
host's `isShortcut(event)` agrees; a window blur lets everything go. When a gamepad connects
the input polls it every 250 ms (`GAMEPAD_POLL_MS`): left stick thrust and strafe, right stick
look (pixels per poll, `stickLook`), right trigger boost, left trigger `brake`; stick values
pass a `deadzone` (`STICK_DEADZONE`, 0.15) and are stretched back to ±1. Polling stops when the
last pad goes. `active` is true while a drag, a held key or a live pad reading is on;
`cancel()` releases everything (a scripted flight takes over) and `dispose()` removes the
listeners. The pure parts are exported for tests and other hosts: `flightAxesFromKeys`,
`readGamepad`, `stickValue`, `wheelPixels`, `axesIdle`, `createFlightAxes` and `FLIGHT_KEYS`.

## Drift

`createDriftCamera(shots, settings)` is a camera that flies itself: from shot to shot
for as long as it runs, with no rig and no renderer. Each `DriftShot` is a pose
(`azimuth`, `inclination`, `distance`, optional `roll` and `look`) with an optional `flight`
(`lift`, `swing`, `lead` and a `duration`), a `hold` in seconds, a hold `drift`
(rad/s) and a `creep` (the fraction of the distance pushed in over the hold).
The camera never stands still: an orbit at the `drift` rate runs under flights and
holds alike (a shot's own `drift` eases in and out over its hold), and the tilt
rises and falls by `sway` radians (a third of that in roll) on slow, unrelated
periods. Settings give the defaults (`flight` 20 s, `hold` 12 s, `drift` 0.01,
`sway` 0.035, `creep` 0.05), a `speed` that scales every duration, a `variance` 0..1 that spreads each shot's
angles (±0.5 rad azimuth, ±0.2 rad inclination, within `inclination` bounds),
distance (±0.3 e-folds) and timing (±35 %), the `order` (`sequence` wraps, `shuffle`
never repeats a shot) and the `random` source; `timeVariance` (default `variance`) is the spread of flight and hold lengths alone: 0 keeps
every loop the same length, for a camera timed to music, while angles and distances still vary.
`opening()` names the shot a sequence opens on at each start (e.g. the one whose cue the music is
nearest); otherwise it opens on the shot after the one nearest the camera. `reduceMotion` cuts flights and
stills the orbit, sway and holds while it matches. `start(pose)` begins from the camera's pose (a
sequence goes on from the shot nearest it); with `cut` (a setting, or `start(pose, { cut })`) it
begins landed on the opening shot instead, the flight's length given to that hold so the loop
keeps its timing, for a host that shows the opening behind a curtain. A shot's `unveil`
(`look`, `rest`, `turn`) plays only on such a cut: the camera begins looking off at `look`,
rests, then turns onto the shot's own look over `turn` seconds of the hold, a reveal for the
opening that a loop flying back to the shot never repeats. `step(dt)` returns the pose for the
frame and `landed` on the one frame a flight ends; `landing` is the pose the flight under way
lands on (before the orbit and sway), null between flights; `motion` is how the drawn pose
turned at the last step (azimuth and inclination, rad/s), kept through a handoff so the host's
own flight can carry the camera's turn on rather than halt it; `reset()` stops. Flights use
`sampleOrbitFlight`, so a zoom across scales keeps an even pace. A shot's `look` eases in over its flight and holds through the hold, so the orbit glides along
wherever it looks; its `ride` (0–1, how far the camera moves with the scene's own flow, which the
host defines, such as orbiting gas) eases the same way. The drawn pose always carries `look` (zero
at the aim) and `ride` (zero, still); `freeFromOrbit` turns it into a free pose, and a rig that
ignores them keeps looking at its aim from rest. A `holdDrift(landed, shot)` setting may
set a shot's hold rate from the pose it landed on (for example, a riding camera orbiting at the
gas's rate for the landed distance); returning undefined keeps the shot's `drift`. A shot of
`{ handoff: true }` is the host's to fly (a close-up on its own rig): the camera
reports `handoff`, leaves the pose alone, and goes on to the next shot from
wherever `resume(pose)` says the host left the camera.

`createDriftRun(shots, settings)` runs that camera from a host's `off`, `playing`
or `paused` state: `step(state, current, dt, hold?)` starts the camera from
`current` on the first playing frame (cutting to the opening shot when the settings say
`cut`) and again after a pause (always flying from `current`), returns the
`pose` to draw or null, `started`, `ended` (once, so the host can give the camera
back where it stopped) and `handoff`; `hold` keeps it from starting or flying
while something else owns the camera. The scene module's `createRigDrift` puts it
on an orbit rig.

## Free camera

`free-pose.ts` is pure maths on tuples, for a raymarched scene, a three.js camera
and a floating-origin host alike. A `FreePose` is `{ position: Vec3, orientation:
Quat }`. The quaternion is camera-to-world in three's camera convention (local −Z
looks into the scene, +Y up, +X right), so `camera.quaternion.fromArray(pose.orientation)`
applies it. The host owns the pose and may overwrite it every frame. `createFlightInput`
(above) is the input that drives it: map its axes to `stepFreeFly` and `onLook` to `turnFree`.

- `freeBasis(q)` gives the world axes (`right`, `up`, `fwd`); `lookRotation(fwd, up?,
  roll?)` builds a level attitude.
- `freeFromOrbit(pose, aim?)` turns an orbit pose (the rigs' convention: `azimuth`
  about +Y from +Z, `inclination` above XZ) into a free pose. Optional `roll` tilts
  about the line of sight (positive turns right toward up). Optional `look: { yaw,
  pitch }` turns the view off the aim (yaw left, pitch up), so a scripted shot can look
  anywhere while it keeps its orbit flights and holds. `orbitFromFree` is its inverse.
- `turnFree(q, yaw, pitch, roll?)` turns like a head: yaw about world up, pitch stopped
  just short of the poles. `revolveFree(pose, angle, axis?, about?)` carries position
  and view round a centre (a glide).
- `sampleFreeFlight(t, from, to, { about? })` eases the position and slerps the
  attitude. With `about`, the flight turns on a great circle round that point and
  eases the distance geometrically, so it never cuts inside the nearer end.
- `stepFreeFly(pose, velocity, move, boost, dt, options)` is one frame of kinematic
  flight. `velocity` is the host's and is updated in place. `move` is
  `{ right, up, forward }` in −1…1, `options.speed(position)` is units per second, and
  `smoothing`, `reduceMotion` and `constrain(position)` are optional. It returns the
  new position; the attitude stays the host's. `easeToward` is the same reduced-motion-aware ease
  for one number.
- `writeCameraMatrix(out, pose)` writes the column-major camera-to-world matrix:
  columns right, up, back and the position, as three's `matrixWorld.elements`. A shader
  reads its ray as `mat3(m) * vec3(uv * tan(fov / 2), -1.0)` from `m[3].xyz`.
  `writeCameraSnapshotFromMatrix(snapshot, m, dist, fov)` fills a projection snapshot
  from either.

## Views

`nearestView(views, distanceOf, distance)` picks the framed view nearest a camera
distance in log space; `atViewScale(distance, viewDistance)` says whether the
camera is still at a view's scale (within a quarter e-fold). Neither needs three.js,
so menus can mark the current view without loading a renderer.
