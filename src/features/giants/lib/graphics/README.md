# Stellar surfaces

The renderer keeps the catalogue's size ladder and per-star exposure. Fine surface work
belongs to one focus owner, fades during a hand-over, and follows the quality preset.
Unfocused bodies retain their silhouette, broad structure, colour and limb darkening;
they skip the costly fine-cell search, spot filaments and detailed clouds. Magnetic
weather retains its separate focus fade. The Display panel's inspection zoom magnifies
the scene about the focused body while retaining physical sizes, picking and ruler units.

The optional **Focus blur** switch is off by default. It is a presentation aid, unrelated
to real line-of-sight distances. One final byte-frame filter softens neighbouring bodies
with a nine-tap binomial kernel (offset capped at 2 CSS pixels, reduced for tiny bodies),
averaging decoded light. The nearest body remains sharp throughout navigation, with a
continuous handover, conservative limb protection, and unfiltered measurement lines and
DOM labels. Background sky outside the bodies is copied. Fine surface work remains limited
to the focus owner; the filter never re-evaluates the stellar shader. Turning it off fades
to the original path with no extra pass; reduced motion switches immediately. Even while
enabled, a conservative viewport test bypasses the filter if no blurred body can contribute,
including when a sharp foreground body covers the entire viewport.

## Continuum and limb darkening

`atmosphere.ts` integrates Planck radiance over 380–780 nm in 5 nm steps using the toolkit's
CIE observer. The spectrum texture stores linear sRGB divided by CIE Y and log Y.
Interpolation is manual, so nearest-filtered float textures need no float-linear extension.
The constant flare colour and each active cloud's emission per unit column are sampled
on the CPU from that same table. Region axes and ejection directions are also computed
once per weather update; their spatial masks and foreground occlusion remain in the shader.
Each star has its own exposure reference; displayed brightness is not an apparent-magnitude
comparison. Negative out-of-gamut components survive until the final display mapping.

`limb-grid.json` contains the corrected
[Claret & Bloemen (2011) CDS table](https://cdsarc.cds.unistra.fr/ftp/J/A+A/529/A75/ReadMe):
508 atmosphere models at solar metallicity, microturbulence 2 km/s, least-squares fits,
Johnson–Cousins R/V/B. ATLAS is used above 3500 K; the subset also includes PHOENIX below
3500 K for cool dwarfs with log g ≥ 3.5. Interpolate gravity within each temperature slice,
then temperature, clamping to available boundaries. Missing giant masses use log g = 0
as a display assumption. Compact remnants and the brown dwarf use an Eddington grey
angular fallback. These bands approximate RGB limb behaviour, not resolved spectra.
The coefficients are evaluated at a representative temperature/gravity per star, not a
new atmosphere calculation for every spot or rotating latitude.

To reproduce the numerical subset, download and decompress the corrected
[tableeq5.dat.gz](https://cdsarc.cds.unistra.fr/ftp/J/A+A/529/A75/tableeq5.dat.gz), then run:

```sh
node scripts/import-giants-limb-grid.mjs /path/to/tableeq5.dat --check
```

The importer checks the decompressed source SHA-256 before extracting coefficients.
Omit `--check` to regenerate, then format the JSON with Oxfmt. No network fetch occurs in
the application or build. Tests check a published solar-like coefficient row, integrated
limb flux, interpolation, grid boundaries and continuum interpolation.

## Rotation and convection

`rotation.ts` implements [Espinosa Lara & Rieutord (2011)](https://arxiv.org/abs/1109.3038),
equations 24–32, including centrifugal acceleration and analytic pole/equator limits.
Its Roche latitude profile is mapped onto the existing spheroid. The **unperturbed**
temperature profile is normalized so that the integral of σT⁴ over that spheroid recovers
the adopted luminosity. Procedural temperature perturbations are not re-normalized each
frame. The spheroid and continuum are approximations, not a fitted stellar atmosphere or
exact Roche silhouette. Tests independently integrate the drawn temperature profile.

Initial inclinations are 6.2° for Vega ([Monnier et al. 2012, Model 3](https://arxiv.org/abs/1211.6055))
and 60.6° for Achernar ([Domiciano de Souza et al. 2014](https://doi.org/10.1051/0004-6361/201424144)).
The hand can turn the globe away from this viewing angle.

Fine granules follow the pressure-scale-height estimate. Their projected width, including
foreshortening and actual drawing-buffer resolution, controls visibility; zoom never
inflates their physical size. Ordinary cool stars, including K giants, use smoothly blended
upflows with continuous internal temperature gradients and irregular, finite-width cool
lanes. Domain advection breaks straight cell boundaries; smaller interior structure has
its own resolution filter. This replaces hard Voronoi borders without changing the input
cell scale. Red-giant granulation is supported by photometry and convection simulations
([Mathur et al. 2011](https://doi.org/10.1088/0004-637X/741/2/119)); the procedural patterns,
contrasts, dark lanes and sparse bright points are illustrative, not a fit to any star.
Supergiant heat, relief and silhouette use one rotating, smoothly evolving low-frequency
field, informed by the broad behaviour of convection simulations
([Chiavassa et al. 2011](https://doi.org/10.1051/0004-6361/201015768)). It is a procedural
surrogate, not a hydrodynamic solution. Rotation, convection and activity use display time.
Red supergiants deliberately use continuous, warped noise at several scales instead of
the ordinary stars' granular upflows and lanes. Broad patches dominate; intermediate structures and faint
fine turbulence appear only in focus. The apparent edge varies by at most 2% of the radius,
an illustrative bound rather than an interferometric fit. Optical and infrared intensity
patterns differ; the continuum rendering cannot reproduce molecular-band images exactly.

## Surface mass loss

Red-supergiant `outflows` are independent of solar flares and CMEs. They follow the
sequence motivated by [Dupree et al. (2022)](https://arxiv.org/abs/2208.01676): surface gas
is expelled, expands and cools, and dust can form later. A cloud retains its launch
direction rather than rotating rigidly with the star. Its column dilutes with inverse
projected area. A simple adiabatic cooling surrogate has an irradiation floor given by
grey-grain equilibrium, T⁴ = ½[1 − √(1 − R²/r²)] T⋆⁴. The assumed condensation interval
1300–1700 K, optical depth, recurrence and display speed are illustrative; no specific
dust mineralogy, mass-loss rate or historical event is inferred.

The shader integrates a Gaussian column in front of the photosphere. Foreground dust
attenuates blue light more strongly than red, while off-limb dust weakly scatters starlight.
Cold dust is not drawn as a bright thermal emitter in visible light. Far-side material is
occluded by the star. Clouds fade with the focused weather owner, and inactive textures
are cleared once rather than uploaded every frame. Tests protect cooling before dust
formation, expansion/dilution, radial detachment, quiet intervals, absence of solar flares,
and cleanup when focus changes.

## Atmosphere and shader limits

Spicule positions and prominence/loop threads are anchored in stellar coordinates;
pixel size filters visibility rather than generating new features on zoom. Loop depth is
compared with the front photosphere so the whole star occludes hidden plasma. Fine rays
and filaments remain illustrative. Coronal and line emission is deliberately enhanced;
the scene is not one calibrated white-light exposure. Chromosphere and spicule heights
use solar-inspired fractions of each star's radius, not measurements of every object.

Both formerly reversed `smoothstep` calls use ascending edges and an explicit complement.
Offline shader tests parse the expanded GLSL; they do not validate GPU output or frame time.

The opt-in granulation regression tests execute the production GLSL in WebGL 2. They check
resolved contrast, smooth spatial and temporal variation, and stable cell positions when
fine interior detail fades. Run them only when browser checks are requested; they use an
installed browser without starting a server:

```sh
HORIZON_TEST_BROWSER=/path/to/chromium node --import tsx \
  --import ./tests/glsl-register.mjs --test tests/browser/giants-granulation.test.mjs
```

Omit `HORIZON_TEST_BROWSER` to use installed Chrome. These checks bound visual artefacts;
they do not validate hydrodynamics, a star's observed appearance, or native GPU frame time.
