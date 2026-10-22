# Deep Field: dark matter and dark energy

Reviewed 2026-10-22. All views use the existing UI and the existing Planck 2018 +
BAO flat ΛCDM distance cosmology. They do not change the galaxy catalogue or move
bound galaxies when the expansion diagram is scrubbed.

## Milky Way halo

`src/space/galaxy/model/dark-halo.ts` owns the numerical inputs, analytical model,
and derived catalogue. Feng et al. (2026), MNRAS stag011, Table 2 Mean reports
ρ(R☉) = 0.36 ± 0.04 GeV/c²/cm³ and M_DM(<18 kpc) = (1.32 ± 0.15) × 10¹¹ M☉,
using R☉ = 8.275 kpc. These are inferred under baryonic and NFW assumptions.

The display solves a spherical NFW profile from those **rounded central values**.
There are two scale-radius branches; choosing the extended branch r_s ≥ R☉ is a
deliberate illustration choice (r_s ≈ 18.94 kpc). It is not a unique solution,
the authors' exact best fit, or a posterior median. Do not infer confidence bands
from the separate errors: their covariance is not supplied. The outer profile
is extrapolated. The R200 shown is the radius at which the _dark component's_
mean density is 200 times critical density, using the atlas H0; baryons are not
included in that density-radius convention. The card diameter is exactly twice
that same computed radius. It is not a measured boundary or total MW mass.

The ray-integrated shader is a false-colour density projection with compressed
opacity. The softened central pixel and fade near the finite rendering extent
are display choices, not a cored or truncated density law. The single optional
radius circle replaces the wireframe sphere. Drift turns both off; Guide shows
the halo at its own stop with its inference callout, without the radius guide.
The projection traces an analytical sphere from a screen quad without depth
testing; no enclosing mesh can cut polygonal holes into the overlay. Camera-ray
uniforms refresh immediately before each draw, after the pass sets its projection.
Framing uses three times the derived radius and holds the Galactic centre;
the halo fades independently of the stellar disc so its extent stays visible
through the transition to the nearby-galaxy view.

Brooks et al. (2026), MNRAS stag926, treats the LMC explicitly and constrains the
outer halo through stellar motions. Dado et al. (2026), MNRAS stag1865, warns
that extrapolating inner-halo fits can bias virial masses. These are linked as
limitations; the renderer does not claim to reproduce their simulations.

## Lensing map

Run `node scripts/fetch-dark-universe.mjs` to refresh the committed snapshot.
This uses Node's standard library and the repository's installed Oxfmt to
format the snapshot before recording its hash.
Scognamiglio et al. (2026), Nature Astronomy, DOI 10.1038/s41550-025-02763-9,
Supplementary Data 3 supplies the JWST **E-mode convergence** grid. Input and
output SHA-256, URL, review date and processing are recorded in
`src/space/cosmos/model/data/cosmos-web-source.json`.

The native 328 × 318 samples are retained, rounded to 10⁻⁶. Exact-zero exterior
padding is masked, not painted as an empty observed universe. FITS rows are
flipped vertically for display. The source has no WCS; no astrometric axes are
invented. The signed map uses a labelled square-root contrast stretch and
separate negative/positive colours. It reconstructs **projected total mass**,
including baryons, and stays in a separate field view; it is never extruded or
placed over the local 3D web. The Guide's web stop identifies it as a separate
survey. Builds are offline; the small JSON is fetched from this app only when
the field is opened, with loading/error/retry states.

## Expansion

`lib/model/dark-universe.ts` evaluates a(t), H(a), density fractions and q(a)
from the same matter + radiation + Λ model as the atlas. Cosmic age uses the
toolkit integrator. The slider covers the past through today; it does not
change the atlas's camera time or positions. Acceleration is q < 0, not an
increasing H. The dark-energy density is constant while its _fraction_ changes.

DESI DR2 IV, arXiv:2607.27410v3 (2026-08-04), supplies the separately displayed
AP + BAO ratios at z_eff = 2.33. They are correlated marginal constraints, not
independent direct dark-energy measurements. The release was a **preprint** at
review. The source status controls its warning and source label. Do not remove
that status until the journal record is checked. We do not fit w0/wa or silently
replace Planck parameters from these two numbers.

## Updating

Update sources and publication states, inputs and explanatory EN/CS callouts
together. All printed input values use the catalogue/formatFigure; formulas
derive the renderer's dimensions. Tests protect the density normalization,
radius definition, map mask/hash, Friedmann evolution and Guide/Drift restoration.
The current snapshot is for education, not parameter estimation.
