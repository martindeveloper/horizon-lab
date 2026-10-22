# Deep Field CMB data

Reviewed **2026-10-23**. The CMB is an observation-derived temperature
reconstruction in every display mode, including Drift and Guide. There is no
procedural CMB fallback. Data mode additionally hides the illustrative population
of galaxies beyond the cosmic web. Local illustrative galaxy populations remain
as described in the existing atlas documentation.

## Pinned products

- **Planck 2018 PR3, SMICA R3.00 full mission**: `I_STOKES`, not
  `I_STOKES_INP`, from the [IRSA release](https://irsa.ipac.caltech.edu/data/Planck/release_3/all-sky-maps/matrix_cmb.html).
  HEALPix NESTED NSIDE 2048, Galactic coordinates, K_CMB converted to µK.
  Require both `TMASK=1` and `TMASKINP=1`.
- **ACT DR6.02 + Planck, NILC blackbody_T, tSZ deprojected** from
  [NASA LAMBDA](https://lambda.gsfc.nasa.gov/product/act/act_dr6.02/act_dr6.02_nilc_info.html).
  CAR projection in ICRS, µK. Require `ilc_footprint_mask >= 0.99` and physical
  `ilc_inpaint_mask=0`. The latter is stored as a byte with BZERO=-128:
  byte 128 means no inpainting, byte 129 flags an inpainted source.
  Mask headers differ from the signal by half a native row
  (CRPIX2=7561 versus 7560.5). Both neighbouring mask rows must pass for a
  signal pixel to be retained; no mask is blindly applied at the same array index.
  This is already an ACT–Planck combination, not independent ACT-only data.
  Source subtraction, residual foregrounds (including kSZ) and noise remain.

PR4/NPIPE is a newer Planck reprocessing. The public PR4 frequency-map index
is not a foreground-cleaned CMB sky; do not relabel a frequency map as CMB or
claim this SMICA product is PR4. The UI explicitly names the older all-sky
baseline and the newer ACT release. Revisit this choice when updating the assets
if a suitable public, masked PR4 component map is available. No runtime request
is made to a scientific archive.

## Rebuild and update

`src/space/cosmos/model/data/cmb-source.json` records exact input URLs, SHA-256
hashes, units, masks, processing, review date, output hashes and reference pixels.
The maps live on the CDN at `textures/cmb/v<VERSION>/cmb-*.png` (mirrored in the ignored
`cdn/` by `npm run cdn:pull`, which the pixel tests need). They are **numerical textures**,
not colour images.

1. Review the pinned release pages, mask conventions, units, coordinate frame,
   component separation and publication status. Update `scripts/fetch-cmb-data.mjs`
   and the callouts in both message catalogues if the product changes.
2. Run `npm ci` to install the repository dependencies. The importer uses Node and
   the existing `sharp` package; no Python environment is needed.
3. Run `node scripts/fetch-cmb-data.mjs --cache /path/to/fits-cache`.
   The four FITS downloads total about 6 GB; keep raw FITS outside the repository.
   Existing cache files must match the pinned byte counts and SHA-256 hashes.
   For a release refresh, update the pinned input hashes after reviewing the source,
   and use a clean cache to compare upstream provenance.
4. Inspect reprojection, masks, signed temperature ranges, ACT–Planck alignment
   and relative resolution. Refresh reference samples and review generated hashes.
5. Run the application checks, `npm run docs:catalogue`, and
   `npm run credits:generate`. Never replace a failed import with generated noise.
6. A rebuild bumps `VERSION` in the script, never overwriting a published key; upload the
   new folder with the command the script prints (`scripts/README.md`).

Planck is averaged in equal-area NESTED cells to NSIDE 512. ACT is averaged in
6×6 native CAR bins with cosine-declination weights. Any invalid native input
invalidates its bin. Each equirectangular output cell uses four area-weighted
subpixel samples, all of which must be valid. This is a display resampling,
not an analysis-grade harmonic filter or a native-resolution data release.
Planck output is 2048×1024 and ACT 4096×2048. Their longitude spacing is
about 10.5 and 5.27 arcminutes; physical angular spacing decreases toward the
Galactic poles. Published beams and native pixel scales must not be confused
with these display grids.

## Encoding and rendering

- PNG `R*256+G` stores `round(temperature_µK / 0.1) + 32768`.
- `B=255` means valid and `B=0` masked. `A=255` always prevents browser alpha
  premultiplication from destroying numeric values. Invalid cells encode zero
  temperature but are never rendered as zero-valued observations.
- No colour profile, sRGB conversion, vertical flip or mipmaps. Filtering is
  linear, with interpolated mask values below the valid threshold rejected.
- The first image row is Galactic north. For pixel centre `(x,y)`,
  `l=(x+0.5)*360/width`, `b=90-(y+0.5)*180/height`.
- The atlas direction is `(-cos(b)cos(l), sin(b), cos(b)sin(l))`. The shader maps
  this direction back to Galactic longitude/latitude; the shell is Sun-centred.
- Where valid, selected ACT detail replaces Planck; elsewhere valid Planck is
  shown. Where neither is valid, a neutral dark mask remains. No extrapolation,
  inpainting or artificial detail is added by Horizon.
- The fixed diverging palette saturates at ±300 µK, a catalogued display choice;
  stored temperatures are not clipped. Opacity is illustrative, not optical depth.
- The last-scattering radius follows the existing cosmology. A three-dimensional
  sphere is a teaching device for an angular sky map, not an observed physical
  boundary. Only the appropriate side is drawn: front outside, back inside.
- Assets load only when the observable-universe scale is reached; while a shown map is
  still loading, the lab's loading badge says so. ACT is optional.
  An insufficient GPU texture limit also falls back to Planck: automatic image
  resizing would corrupt packed temperatures, so unsupported detail is rejected.
  On failure the UI names the remaining coverage, offers retry, and never
  fabricates a replacement. Late loads are disposed when the scene is destroyed.

The existing dark scene, typography, cards, Callout and Disclosure components are
retained. No new shared UI or web-storage contract is introduced.
