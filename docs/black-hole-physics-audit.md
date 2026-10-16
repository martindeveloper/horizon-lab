---
title: Black-hole physics audit
description: What the black-hole observatory computes exactly, what it approximates, the corrections made, and how its rendering cost was measured.
sidebar_position: 5
tags: [black-hole, physics, general-relativity, rendering, audit]
---

# Black-hole physics and rendering audit

Reviewed 15 October 2026; disk shading revised the same day. Preset viewing angles and
catalogue numbers rechecked 16 October 2026. This is an educational illustration with analytic
physical readouts, not a validated general-relativistic radiative-transfer code.
The distinction matters most at high spin and close to the horizon.

## What is quantitative

The readouts implement the uncharged Kerr outer horizon, prograde equatorial
photon orbit, ISCO, and circular-orbit period in geometric units. The photon
orbit is not the apparent ring radius and not the entire Kerr photon region.
[Bardeen, Press & Teukolsky (1972)](https://doi.org/10.1086/151796) is the orbital reference.
Tests cover Schwarzschild limits, near-extremal ISCO values, negative-spin
horizon symmetry, physical unit conversion and mass scaling.

The falling clocks use radial Schwarzschild free fall with specific energy
E=1: dτ/dt=1−2/r and dr/dt=−(1−2/r)√(2/r). These are coordinate-time ratios,
not observed pulse-arrival rates. The model stops at 2.06 M, is independent of
selected spin, and does not depict horizon crossing. Compare
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
  square-root equation. The shader's frequency factor remains approximate.
  [Kulkarni et al. (2011)](https://academic.oup.com/mnras/article/414/2/1183/977096).
- A non-spinning hole can have a Doppler-bright disk crescent: its disk still
  rotates. A lensed disk is not necessarily an Einstein ring.
  [NASA's disk visualization](https://www.nasa.gov/universe/nasa-visualization-shows-a-black-holes-warped-world/).
- Removed near-horizon companion stars and streams. S2's pericentre is about
  120 au, approximately 2,800 M, not tens of M. Corrected the attribution of
  the 4.297-million-solar-mass and 8.277-kpc values to
  [GRAVITY (2022)](https://www.aanda.org/articles/aa/full_html/2022/01/aa42465-21/aa42465-21.html).
- Retained the qualified Cygnus X-1 discussion: the adopted 15 M☉ is an
  illustrative value, not a unique measurement. Compare the dynamical result
  [Miller-Jones et al. (2021)](https://arxiv.org/abs/2102.09091) with
  [Ramachandran et al. (2025)](https://arxiv.org/abs/2504.05885).
  The M87* 43.9 ± 0.6 μas ring statement is supported by
  [EHT's multi-epoch study (2025)](https://arxiv.org/abs/2509.24593).
- The blackbody fit's hot-branch green coefficient used the red constant
  (1.293 instead of 288.12/255 = 1.130), tinting every disk above 6,600 K
  cyan by 10–15% in green. It now matches [Helland's fit](https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html).
- Disk brightness had a constant floor (0.22 + 0.95 F/0.65), which made the
  outer disk up to 2.3× too bright relative to the Page–Thorne peak at spin
  0.82. Brightness is now proportional to F and temperature to F^(1/4), with
  the former peak values kept as display scales (1.68 and 15,800 K).
- A grazing "path length" boost (up to 1.75×) treated the opaque disk as
  optically thin. It is replaced by Chandrasekhar's electron-scattering limb
  darkening, I ∝ 1 + 2.06 μ, normalized to an isotropic emitter's flux. μ is
  taken from the coordinate-frame ray tangent without orbital aberration.
- Removed artificial photon-ring glow, amplified hotspot echoes and a
  post-tonemap highlight boost. Replaced reversed-edge GLSL `smoothstep`
  calls, whose results are [undefined by the specification](https://registry.khronos.org/OpenGL-Refpages/gl4/html/smoothstep.xhtml).
- Catalogue presets open at their measured viewing angles: Sgr A* at i ≈ 30°
  (EHT 2024, i = 150°), M87* at the jet's 17° and Cygnus X-1 at its 27.5° orbital
  inclination ([Miller-Jones et al. 2021](https://arxiv.org/abs/2102.09091)).
  Cygnus X-1's spin of 0.95 is a teaching value: continuum fits give > 0.9985,
  warm-corona fits far less.

## What remains approximate

At zero spin, the spatial ray acceleration is the Schwarzschild affine-ray
form; the initial tangent now matches a static local observer with E=1.
Finite-step velocity Verlet integration is not an error-controlled precision
solver. It replaced a two-evaluation Heun step on 16 October 2026: one
acceleration per step at equal accuracy, and exact conservation of L at a = 0.
The saved work raised the budgets to 144, 192 and 256 steps. Rays that ran out
of steps near the critical curve were drawn dark, inflating the zero-spin shadow
(true edge b = 3√3 M ≈ 5.196 M) to 6.8–9.0 M at 72 steps and 5.3–5.7 M at 112.
At 144 steps the edge lies within 1.8% at every camera distance; at 192, within 0.1%.
At nonzero spin the added twist is a heuristic, not Kerr frame dragging from
the metric. The rotating shadow and critical curve are **not quantitatively
validated**. Readout accuracy must not be used as evidence of image accuracy.

Emission stops at the first disk intersection. There is no optically thin
volume transfer, plasma dynamics, magnetic-field evolution, polarization or
physical accretion-rate normalization. Colours, hotspot motion, dust, jets and
filaments are illustrative. Animation seconds are not physical seconds.
Sgr A* and M87* have hot, radiatively inefficient flows; these thin-disk views
are not EHT reconstructions. The camera is not a relativistic observer, and
its inside-horizon fade is not an infall prediction.

A future precision mode needs a validated Kerr geodesic solver, local observer
frames, invariant radiative transfer and image convergence benchmarks before
claiming scientific fidelity. Faster hardware or more steps alone will not fix
the present rotating model.

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

`tests/black-hole-physics.test.mjs` covers formulas, flux convergence and budgets.
Toolkit tests cover frame-loop suspension and disposal. Browser checks cover
actual shader compilation, controls, and narrow/wide layouts. These are not
measured watts, battery-duration tests or a GPU performance benchmark. Actual
power depends on device, browser, screen size and selected quality.

On 16 October 2026 the bench (`npm run bench`) attributed GPU time at 1920×1080 on
an Apple M5 Max by switching components off between bracketing baseline runs.
In near views, the march was about 60% of the frame, the dusty wind and jet
volumes 23%, the sky 11–19% (72% from 480 M) and disk texture 2–8%. The dust is
a Gaussian cone around slope 0.38. Samples more than 0.26 from that slope, where
the cone's weight is under 1% of its peak, are now rejected with one comparison,
and outbound rays end at the cone's far corner (above). Together that made near
views 11–15% faster, measured against bracketing HEAD runs. Images differ only by
sub-pixel star shifts from the earlier hand-off to the analytic tail.

## Finite rendering boundaries

Outbound rays stop once nothing is left to draw, rather than returning to the
camera radius. Without a jet that is the dust cone's far corner, about 1.78 disk
radii (27.8 M). With a jet it is the 36 M far-field radius, and never beyond
48 M. Handing over at any radius from 18 to 48 M gave the same sky accuracy in
tests, and the earlier exit saves about 12% of steps. Far-field steps retain the
10% radial displacement bound, with a 48 M ceiling, to avoid exhausting the fixed
budget at the maximum 480 M camera distance. Bending beyond this boundary, and
for rays too far out to march, is added analytically along the
remaining straight path: in these coordinates the bending term falls as 1/r⁴,
giving (1/b)[2 − s(2s² + 3b²)/(b² + s²)^(3/2)] (4M/b for a full pass), with the
second-order 15πM²/4b² shared in the same proportion. This replaced a blend that
faded rays passing 8–24 M back towards their undeflected direction: a star seen
at b = 20 M was bent 3° instead of 12°. At zero spin, escaped sky directions now
agree with a converged integration within 0.2°.
The disk's finite outer display window fades both emission and coverage,
compositing the background through the taper. This is an artistic truncation
treatment, not a prediction of optical depth or the physical outer disk radius.
