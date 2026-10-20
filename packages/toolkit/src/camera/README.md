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
viewport height per page) before applying sensitivity. Call `cancel()` when a scripted tour takes control and
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

## Drift

`createDriftCamera(shots, settings)` is a camera that flies itself: from shot to shot
for as long as it runs, with no rig and no renderer. Each `DriftShot` is a pose
(`azimuth`, `inclination`, `distance`, optional `roll`) with an optional `flight`
(`lift`, `swing`, `lead` and a `duration`), a `hold` in seconds, a hold `drift`
(rad/s) and a `creep` (the fraction of the distance pushed in over the hold).
The camera never stands still: an orbit at the `drift` rate runs under flights and
holds alike (a shot's own `drift` eases in and out over its hold), and the tilt
rises and falls by `sway` radians (a third of that in roll) on slow, unrelated
periods. Settings give the defaults (`flight` 20 s, `hold` 12 s, `drift` 0.01,
`sway` 0.035, `creep` 0.05), a `speed` that scales every duration, a `variance` 0..1 that spreads each shot's
angles (±0.5 rad azimuth, ±0.2 rad inclination, within `inclination` bounds),
distance (±0.3 e-folds) and timing (±35 %), the `order` (`sequence` wraps, `shuffle`
never repeats a shot) and the `random` source; `reduceMotion` cuts flights and
stills the orbit, sway and holds while it matches. `start(pose)` begins from the camera's pose (a
sequence goes on from the shot nearest it); `step(dt)` returns the pose for the
frame and `landed` on the one frame a flight ends; `reset()` stops. Flights use
`sampleOrbitFlight`, so a zoom across scales keeps an even pace. A shot of
`{ handoff: true }` is the host's to fly (a close-up on its own rig): the camera
reports `handoff`, leaves the pose alone, and goes on to the next shot from
wherever `resume(pose)` says the host left the camera.

`createDriftRun(shots, settings)` runs that camera from a host's `off`, `playing`
or `paused` state: `step(state, current, dt, hold?)` starts the camera from
`current` on the first playing frame (and again after a pause), returns the
`pose` to draw or null, `started`, `ended` (once, so the host can give the camera
back where it stopped) and `handoff`; `hold` keeps it from starting or flying
while something else owns the camera. The scene module's `createRigDrift` puts it
on an orbit rig.

## Views

`nearestView(views, distanceOf, distance)` picks the framed view nearest a camera
distance in log space; `atViewScale(distance, viewDistance)` says whether the
camera is still at a view's scale (within a quarter e-fold). Neither needs three.js,
so menus can mark the current view without loading a renderer.
