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
`turn.azimuth` / `turn.inclination` times `step` (default 15°), with inclination
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
