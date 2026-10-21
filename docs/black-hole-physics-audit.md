---
title: Black-hole physics audit
description: What the black-hole observatory computes exactly, what it approximates, the corrections made, and how its rendering cost was measured.
sidebar_position: 5
tags: [black-hole, physics, general-relativity, rendering, audit]
---

# Black-hole physics and rendering audit

Reviewed 15 October 2026; disk shading revised the same day. Preset viewing angles and
catalogue numbers rechecked 16 October 2026. On 19 October 2026 the heuristic spin
twist was replaced by Kerr null geodesics seen from a hovering camera (below). Light
paths, the capture boundary and frequency shifts are now computed from the metric; the
glowing gas is still an educational illustration, not a general-relativistic
radiative-transfer model.

## What is quantitative

The readouts implement the uncharged Kerr outer horizon, prograde equatorial
photon orbit, ISCO, and circular-orbit period in geometric units. The photon
orbit is not the apparent ring radius and not the entire Kerr photon region.
[Bardeen, Press & Teukolsky (1972)](https://doi.org/10.1086/151796) is the orbital reference.
Tests cover Schwarzschild limits, near-extremal ISCO values, negative-spin
horizon symmetry, physical unit conversion and mass scaling.

Rays follow Kerr null geodesics in Mino time with exact conserved E, L and Carter's Q
([Mino 2003](https://arxiv.org/abs/gr-qc/0302075)). The radial motion is integrated in
u = 1/r, where (du/dλ)² is a quartic polynomial; the polar direction moves on the unit
sphere, so the poles are regular; frame dragging rotates both about the spin axis. The
camera is a zero-angular-momentum observer (ZAMO), the local frame that exists at every
radius outside the horizon ([Bardeen, Press & Teukolsky 1972](https://doi.org/10.1086/151796)).
`lib/kerr-rays.ts` mirrors the shader's integrator step for step. Tests compare it with the
analytic critical curve for the same finite-distance ZAMO, built from the spherical photon
orbits (Bardeen 1973; Teo 2003): converged capture edges agree within
0.4% for spins −0.9 to 0.998 and inclinations from edge-on to 73°, at 8–480 M. At the
Standard budget of 192 steps they stay within 3.5%; the near-extremal prograde edge, where
rays wind longest, is the worst case. Rays that exhaust the budget are reported apart from
captured rays. Carter's constant is kept to rounding, and disk crossings change by under
0.5% with eight-times-finer steps. Escaped sky directions agree with converged rays to about
0.15° (median) and 0.5° (worst sampled).

The falling clocks use radial Schwarzschild free fall with specific energy
E=1: dτ/dt=1−2/r and dr/dt=−(1−2/r)√(2/r). These are coordinate-time ratios,
not observed pulse-arrival rates. The model stops at 2.06 M, keeping its last rate
(dτ/dt ≈ 0.029, not zero), is independent of selected spin, and does not depict horizon
crossing; the panel says so. Compare
[NASA's black-hole FAQ](https://science.nasa.gov/apod/frequently-asked-questions-faqs-on-black-holes/).

The disk's relative radial flux follows the zero-torque thin-disk expression of
[Page & Thorne (1974)](https://articles.adsabs.harvard.edu/pdf/1974ApJ...191..499P).
A 512-point CPU table replaces repeated six-interval shader integrations.
Tests compare it with 8,177 samples for four spins, requiring error below 0.5%
of peak flux, and check the large-radius Newtonian limit. This validates the
relative profile, not the final displayed RGB intensity or a real accretion flow.

## Corrections made

- The Schwarzschild shadow's angular diameter is approximately
  6√3 GM/(c²D), not GM/(c²D). The latter is one gravitational radius:
  about 5.1 μas for Sgr A*, not 52 μas. The estimated critical-curve diameter
  is about 53 μas; an observed emission ring is a different quantity.
  [Narayan, Johnson & Gammie (2019)](https://arxiv.org/abs/1910.02957).
- Spectral intensity transforms as Iν,obs(ν)=g³ Iν,em(ν/g); bolometric
  intensity as Iobs=g⁴ Iem. Removed the incorrect mixed δ³/gravitational
  square-root equation. Since 19 October the shader's g is exact for its camera (below).
  [Kulkarni et al. (2011)](https://academic.oup.com/mnras/article/414/2/1183/977096).
- A non-spinning hole can have a Doppler-bright disk crescent: its disk still
  rotates. A lensed disk is not necessarily an Einstein ring.
  [NASA's disk visualization](https://www.nasa.gov/universe/nasa-visualization-shows-a-black-holes-warped-world/).
- Removed near-horizon companion stars and streams. S2's pericentre is about
  120 au, approximately 2,800 M, not tens of M. Corrected the attribution of
  the 4.297-million-solar-mass and 8.277-kpc values to
  [GRAVITY (2022)](https://www.aanda.org/articles/aa/full_html/2022/01/aa42465-21/aa42465-21.html).
- Cygnus X-1 now uses the shared catalogue's dynamical mass, 21.2 M☉ (19–23.4) from
  [Miller-Jones et al. (2021)](https://arxiv.org/abs/2102.09091), the figure the Giants lab
  shows too; [Ramachandran et al. (2025)](https://arxiv.org/abs/2504.05885) is the comparison.
  The M87* 43.9 ± 0.6 μas ring statement is supported by
  [EHT's multi-epoch study (2025)](https://arxiv.org/abs/2509.24593).
- The blackbody fit's hot-branch green coefficient used the red constant
  (1.293 instead of 288.12/255 = 1.130), tinting every disk above 6,600 K
  cyan by 10–15% in green. It matched [Helland's fit](https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html)
  after the fix; the disk now reads the CIE 1931 black-body lookup (`blackbodyLut`) as linear
  light instead, and the display encodes sRGB at the end, so the wide-colour matrix works on
  linear light.
- Disk brightness had a constant floor (0.22 + 0.95 F/0.65), which made the
  outer disk up to 2.3× too bright relative to the Page–Thorne peak at spin
  0.82. Brightness is now proportional to F and temperature to F^(1/4), with
  the former peak values kept as display scales (1.68 and 15,800 K).
- A grazing "path length" boost (up to 1.75×) treated the opaque disk as
  optically thin. It is replaced by Chandrasekhar's electron-scattering limb
  darkening, I ∝ 1 + 2.06 μ, normalized to an isotropic emitter's flux, with μ
  measured in the gas's rest frame since 19 October.
- Removed artificial photon-ring glow, amplified hotspot echoes and a
  post-tonemap highlight boost. Replaced reversed-edge GLSL `smoothstep`
  calls, whose results are [undefined by the specification](https://registry.khronos.org/OpenGL-Refpages/gl4/html/smoothstep.xhtml).
- Catalogue presets open at adopted viewing angles: Sgr A* at i ≈ 30°, model-dependent
  (the EHT 2024 conditional model fit with i = 150°), M87* at the jet's 17° and Cygnus X-1
  at its 27.5° orbital inclination ([Miller-Jones et al. 2021](https://arxiv.org/abs/2102.09091)).
  Cygnus X-1's spin of 0.95 is a teaching value: continuum fits give > 0.9985,
  warm-corona fits far less.

## Review of 19 October 2026

An external review was checked against the code; each point held.

- The spin twist was not Kerr. Re-running the former march on the CPU at a = 0.998,
  edge-on from 480 M, put the capture edges at 4.05 M and 6.10 M; Kerr gives 2.11 M and
  6.98 M. More steps did not help. The renderer now integrates Kerr geodesics (above).
- Falling clocks displayed 0.00× after stopping at 2.06 M, where dτ/dt ≈ 0.029. They now
  keep that rate, and the panel is labelled as a Schwarzschild coordinate-time model.
- Disk g assumed an observer at infinity while the camera sat at finite radius. The photon's
  E and L are now normalised in the camera's frame, so g includes the camera's own shift:
  at a = 0 and 26 M a factor 1/√(1 − 2/26) ≈ 1.041 in frequency, 17% in bolometric
  intensity. Starlight gains the camera's blueshift 1/E as g⁴. The g clamp (0.2–2.5) was
  removed; only the colour-temperature lookup is bounded.
- The red tint, darkening and tunnel near the horizon, and the ember inside it, implied
  that a falling observer's universe goes dark. They are gone. The camera hovers as a ZAMO,
  which cannot exist inside the horizon, so it stays at least 0.3 M outside it. The control
  label reads "near horizon" in both languages.
- Limb darkening now uses μ = g√Q/r, the emission angle in the gas's rest frame, rather
  than the coordinate-frame tangent. The glare highlight, which added flux, was removed.
  Gas inside the ISCO keeps the ISCO's E and L ([Cunningham 1975](https://doi.org/10.1086/154033)),
  which sets its g; its emissivity stays illustrative. That glow was first drawn only on rays
  that went on to escape, and at up to a third of the disk's peak: beside the shadow on the
  approaching side it cut a bright, hard-edged band next to the disk's lensed secondary image.
  It now shows on every ray that crosses it, at under a tenth of the disk's peak. The dark gap
  between the disk's inner edge and that secondary image is real for a disk ending at the ISCO. Temperatures remain display scales
  without an observing band; animation is not mass-scaled and has no light-travel delays.
- Sgr A* and M87* show a visible "illustrative thin disk, not an EHT image" note: their
  horizon-scale light is synchrotron emission from hot, optically thin flows
  ([EHT 2025](https://arxiv.org/abs/2509.24593)). The "dusty wind" is now an illustrative
  glow; dust would need a sublimation model ([Baskin & Laor 2018](https://arxiv.org/abs/1711.00025)).
- The lesson no longer equates the dark patch with the shadow: emission, opacity and the disk's
  inner edge shape it ([Gralla, Holz & Wald 2019](https://arxiv.org/abs/1906.00873)). The guide's
  overlay is now the exact critical curve for the renderer's camera, labelled as theory.
- Readouts qualify ω Centauri's ≥ 8,200 M☉ as one study's bound for a debated candidate and
  Cygnus X-1's mass with its published range.

## Gravity off: the flat-space comparison

A Gravity switch (Spacetime, on by default; presets and the guide turn it back on) draws the
same scene in Minkowski space so students can see what lensing does. Rays run straight from a
static camera, with no analytic far-field bend; only a dark ball of radius r₊ captures, and
starlight is unshifted. The disk, glow, jet and sky are sampled by the same code at the same
step lengths, on the chord through the exit sphere. Disk gas keeps the Kerr Ω, so the image
keeps the special-relativistic Doppler factor g = √(1 − v²)/(1 − v·n) and its brighter
approaching side; gravitational and frame-dragging shifts are gone. The plunge glow is drawn
unshifted, since its motion exists only because of gravity. `traceFlatRay` and
`flatDiskShift` in `lib/kerr-rays.ts` mirror the shader; tests check that rays missing the
ball escape along their initial direction, that a ray aimed at a disk point crosses there,
and that the Doppler factor is 1/γ transverse with approaching × receding = 1.

## What remains approximate

Finite-step velocity Verlet integration is not an error-controlled precision
solver. Budgets are 144, 192 and 256 steps. Rays that run out of steps near the
critical curve are drawn dark, so the dark region can be slightly larger than the
capture boundary; at 192 steps the excess is under 3.5% even at a = 0.998. The CPU
mirror, not the GPU, is what the tests check: browser shader compilation is checked
offline by the GLSL parser, and float precision on the GPU is not separately validated.

Emission stops at the first disk intersection. There is no optically thin
volume transfer, plasma dynamics, magnetic-field evolution, polarization or
physical accretion-rate normalization. Colours, hotspot motion, the glow, jets and
filaments are illustrative. Animation seconds are not physical seconds.
Sgr A* and M87* have hot, radiatively inefficient flows; these thin-disk views
are not EHT reconstructions, and the scene says so. The camera hovers; it is not a
falling observer.

A future precision mode needs invariant radiative transfer through optically thin
plasma, a physical temperature normalisation with an observing band, and mass-scaled
time with light-travel delays before claiming quantitative brightness or colour.

## Rendering cost and verification

The feature caps pixels and FPS even without battery detection, requests a
low-power GPU, caches radial flux, supports full-scene pause, and suspends the
GPU loop in hidden pages and the atlas. See `render-policy.ts` and the generated
feature README for budgets. Controls still redraw a paused scene. DOM overlays
have separate lightweight scheduling; pause does not claim zero total CPU use.
Portrait framing now keeps the hole in view without changing projection-marker
agreement. Regular concentric texture bands were rejected during visual review: they
misleadingly suggested separate physical rings. A Page–Thorne disk is smooth
by definition, so any texture is illustrative, not a plasma simulation. It now
imitates shear-stretched turbulence seen in disk simulations: value noise on a
sheared lattice that closes around the disk, giving trailing filaments of about
14° pitch and 5:1 aspect instead of isotropic blobs. The local fluctuation
(±40% face-on) also sets temperature through T ∝ F^(1/4). Two finite-lived
patches crossfade while differential rotation shears their structure.
Contrast is reduced at grazing angles. Screen derivatives must not be used
inside divergent ray-hit branches: they produced broken streaks in visual QA.
The detail adds no ray steps or render passes; pixel and frame-rate budgets
remain unchanged.

Experimental anti-aliasing (off by default) offers FXAA or edge rays. FXAA filters the
finished, tone-mapped frame in one pass: it softens stair steps but cannot restore a ring
thinner than a pixel that single rays missed. Edge rays (`<horizon/supersample>`) keeps the
one-ray frame and, in a second pass over it, traces four extra rays on a rotated grid only
where a pixel's 3 × 3 neighbourhood spans a luma difference of 0.04 or more. Thin photon
rings and the lensed crescent's rim then join up because more rays hit them. Those extra
rays cannot use screen derivatives, so their star footprint is one pixel. Both modes leave
the pixel and frame-rate budgets unchanged; edge rays cost about four rays per edge pixel.

`tests/black-hole-physics.test.mjs` covers formulas, flux convergence, budgets and the
rendered ray model: capture boundaries across spin, inclination and distance, conserved
quantities, step convergence of disk images, and finite-observer frequency shifts.
Toolkit tests cover frame-loop suspension and disposal. Browser checks cover
actual shader compilation, controls, and narrow/wide layouts. These are not
measured watts, battery-duration tests or a GPU performance benchmark. Actual
power depends on device, browser, screen size and selected quality.

The Kerr step of 19 October does more arithmetic than the former one: a radial and a sphere
acceleration, a drag rotation (one sine and cosine) and about four square roots and three
divisions. It needs fewer steps: counted on the CPU mirror over every preset's home view, a
marched pixel averages 20–26 steps instead of 26–33, 25% fewer overall. The step reuses
what it already knows: |ds/dλ| comes from Carter's constant rather than a vector length,
r = 1/u is computed once, U and dU/du share terms, and the step length for the glow and
jet is measured only inside them. On 19 October 2026 the bench (1280×720, two interleaved
rounds, Apple M5 Max) put the Kerr march 5–20% above the former heuristic in the preset and
edge-on views, 58% above it in the near-extremal close-up from 6 M, where rays now wind near
the photon orbit as they should. Reusing those values made every scene about 3% faster than
the first Kerr shader, with pixels unchanged; repeat runs of the same code agreed within 0.7%.
The component figures below describe the earlier march. On 16 October 2026 the bench (`npm run bench`) attributed GPU time at 1920×1080 on
an Apple M5 Max by switching components off between bracketing baseline runs.
In near views, the march was about 60% of the frame, the glow and jet
volumes 23%, the sky 11–19% (72% from 480 M) and disk texture 2–8%. The glow is
a Gaussian cone around slope 0.38. Samples more than 0.26 from that slope, where
the cone's weight is under 1% of its peak, are now rejected with one comparison,
and outbound rays end at the cone's far corner (above). Together that made near
views 11–15% faster, measured against bracketing HEAD runs. Images differ only by
sub-pixel star shifts from the earlier hand-off to the analytic tail.

## Finite rendering boundaries

Outbound rays stop once nothing is left to draw, rather than returning to the
camera radius. Without a jet that is the glow cone's far corner, about 1.78 disk
radii (27.8 M). With a jet it is the 36 M far-field radius, and never beyond
48 M. Handing over at any radius from 18 to 48 M gave the same sky accuracy in
tests, and the earlier exit saves about 12% of steps. Beyond 8 M a step moves a ray
10% of its radius, growing as √(r/8 M) to 30% far out, so the march from the maximum
480 M camera distance does not exhaust the fixed budget. Bending beyond this boundary, and
for rays too far out to march, is added analytically along the
remaining straight path: in these coordinates the bending term falls as 1/r⁴,
giving (1/b)[2 − s(2s² + 3b²)/(b² + s²)^(3/2)] (4M/b for a full pass), with the
second-order 15πM²/4b² shared in the same proportion. This replaced a blend that
faded rays passing 8–24 M back towards their undeflected direction: a star seen
at b = 20 M was bent 3° instead of 12°. Escaped sky directions agree with a converged
integration to about 0.15° (median); spin enters the tail at order a/b², which is small
beyond the hand-off radius.
The disk's finite outer display window fades both emission and coverage,
compositing the background through the taper. This is an artistic truncation
treatment, not a prediction of optical depth or the physical outer disk radius.
