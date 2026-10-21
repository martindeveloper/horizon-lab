# Stellar surfaces

The renderer keeps the catalogue's size ladder and per-star exposure. Fine surface work
belongs to one focus owner, fades during a hand-over, and follows the quality preset.
Unfocused bodies retain their silhouette, broad structure, colour and limb darkening;
they skip the costly fine-cell search, spot filaments and detailed clouds. Magnetic
weather retains its separate focus fade. The Display panel's inspection zoom magnifies
the scene about the focused body while retaining physical sizes, picking and ruler units.

## Continuum and limb darkening

`atmosphere.ts` integrates Planck radiance over 380–780 nm in 5 nm steps using the toolkit's
CIE observer. The spectrum texture stores linear sRGB divided by CIE Y and log Y.
Interpolation is manual, so nearest-filtered float textures need no float-linear extension.
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
inflates their physical size. Dark lanes and sparse bright points are illustrative.
Supergiant heat, relief and silhouette use one rotating, smoothly evolving low-frequency
field, informed by the broad behaviour of convection simulations
([Chiavassa et al. 2011](https://doi.org/10.1051/0004-6361/201015768)). It is a procedural
surrogate, not a hydrodynamic solution. Rotation, convection and activity use display time.

## Atmosphere and shader limits

Spicule positions and prominence/loop threads are anchored in stellar coordinates;
pixel size filters visibility rather than generating new features on zoom. Loop depth is
compared with the front photosphere so the whole star occludes hidden plasma. Fine rays
and filaments remain illustrative. Coronal and line emission is deliberately enhanced;
the scene is not one calibrated white-light exposure. Chromosphere and spicule heights
use solar-inspired fractions of each star's radius, not measurements of every object.

Both formerly reversed `smoothstep` calls use ascending edges and an explicit complement.
Offline shader tests parse the expanded GLSL; they do not validate GPU output or frame time.
