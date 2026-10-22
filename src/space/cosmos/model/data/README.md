# Cosmic atlas snapshot

Reviewed **2026-10-22**. Refresh with `node scripts/fetch-cosmic-data.mjs` from the
repository root. Node's standard library is sufficient. Builds read the committed
snapshot and never query an archive. `sources.json` pins every URL, arXiv version,
publication state, review date and SHA-256. Do not change a preprint label just because
a newer manuscript exists: verify the journal record and revise the manifest.

## What is imported

| File                   | Source                                                              | Meaning                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `cf4.json`             | Tully et al. 2023, CDS J/ApJ/944/94 table 3                         | 38,053 group records, angles, CMB-frame cz, calibrated distance modulus and its tabulated uncertainty                      |
| `classix.json`         | Böhringer et al. 2025, CDS J/A+A/695/A59                            | All 185 clusters in the five superstructures; 68 are Quipu members                                                         |
| `desi.json`            | DESI DR1, iron zcatalog **v1**, 2026-07-10                          | 14,367 galaxies from a deterministic sparse sample; not the full DR1 catalogue                                             |
| `reconstructions.json` | Valade et al. 2024, Table 1                                         | All 17 inferred CF4 basins, centre coordinates, axis-wise positional standard deviations, existence probability and volume |
| same                   | Hollinger et al. 2026, **2603.09339v2**, accepted by A&A 2026-06-22 | Vela's density peak, full overdense volume and inferred mass (Table 2)                                                     |
| same                   | Hollinger & Courtois 2026, **2606.13538v1**, preprint               | All 37 voids and 42 knots from Tables A.1/A.2 at eigenvalue threshold zero                                                 |

The South Pole Wall has an approximate Chamaeleon+11.8 peak marker from Pomarède
et al. 2020, §III. Its original grid/surface is **not** imported. The Sloan basin's
coordinates/probability use the published 2024 table; the **2606.04578v1** preprint
adds interpretation, including its unbounded southern extent. These are separate
from the historical Sloan Great Wall galaxy landmark.

## Frames and scientific limits

- Renderer coordinates are galactocentric **Mly**, with +X from the Galactic centre
  to the Sun, +Y to the Galactic north pole and +Z toward Galactic longitude 90°.
  Supergalactic positions are rotated and translated by the Sun's position exactly
  once. Tables use **h₁₀₀⁻¹ Mpc**, not h₇₀⁻¹ Mpc: multiply lengths by `1 / (H0 / 100)`
  using the existing Planck 2018 cosmology. Volumes carry the cube of that factor.
  This is a unit rescaling, not a fresh reconstruction under Planck parameters.
- CF4's `Vcmb` already includes the observer-motion correction. CLASSIX and DESI
  observer-frame redshifts receive the existing low-redshift CMB dipole correction.
  Angles/redshifts are measured; comoving radial distances are cosmology-dependent.
  No peculiar-velocity correction is inferred from these point records. CF4's
  retained distance moduli are **not** used as geometry or as a velocity field.
  `modulusError` is CDS `e_DMav`, the tabulated error on the unshifted average; blank
  values remain null, not zero uncertainty. Nonpositive cz records are omitted from
  redshift geometry, not moved to the origin. Other local maps cover the bound regime.
- Surveys overlap and have different selections. The layer is not a deduplicated,
  homogeneous volume census. Neither a blank region nor a sparse region in the
  visual sample establishes a void. Point brightness is an illustration, not flux.
- DESI uses 128 uniformly spaced blocks of 256 FITS rows (32,768 examined), keeps
  unique primary GALAXY rows with ZWARN = 0, COADD_FIBERSTATUS = 0, DELTACHI2 ≥ 40
  and 0.1 < z ≤ 0.4. The FITS schema is decoded from its header. This efficient,
  reproducible visual sample is **not suitable for clustering or completeness
  statistics**, and does not provide a survey mask. The SHA-256 is over the header
  and sampled byte ranges in order, **not the entire FITS file**. Row counts and the
  exact selection are in the manifest. Keep TARGETID as a string (64-bit integer).
- Quipu's centroid is the unweighted mean of imported member positions. Its published
  extent and inferred total mass retain the authors' H₀ = 70, Ωm = 0.3 convention;
  reprojected point positions use Planck. No friends-of-friends links are fabricated.
- Vela v2's mass is for the full δ = 0 region and uses H₀ = 74.6. The 2026 knot table
  covers collapsing subregions with different definitions and much smaller masses;
  never substitute one for the other. The raw Vela peak differs from its V-web core.
- Basin crosses show axis-wise **one-standard-deviation positional spreads**, not
  flow vectors or boundary shapes. The probability of a basin existing is distinct
  from the Milky Way's posterior membership (Shapley 58%, Ophiuchus 39%). Smoothing
  changes which basin contains a streamline; Laniakea has not simply been erased.
- Void circles and Vela's circle are camera-facing **equivalent-volume size guides**,
  not reconstructed surfaces. An inner void circle gives the effective radius of
  the subvolume classified as void in ≥68% of realizations; it is not a radius error
  bar, or a geometrically nested core. Reconstructed centres use small hollow rings;
  knots use flat hollow diamonds. These markers have fixed screen sizes at every zoom,
  never physical extents. Only a selected landmark's error bars or size circles appear
  by default. The View panel's `cosmicGuides` switch explicitly enables the full overlay;
  keep it off by default so the survey overview remains readable.
- The void paper's summary Table 1 declinations disagree with its appendix/Cartesian
  columns. We use appendix **SGX, SGY, SGZ**, retaining their published signs, and do
  not mix sky positions from the summary. The grid resolution limits precision.
- Original seeded web/flow geometry remains a separate **illustration**. The map's
  **Data / Illustration / Both** control defaults to Both, preserving the familiar
  Laniakea/Great Attractor flow shape beside the new catalogues. Data mode hides the
  illustrated web/flows and fades the nearby sketch populations before the atlas
  dominates; original named cluster anchors retain their glows. Illustration mode
  hides the atlas points, reconstruction markers and their guides. Layer preferences
  are retained while the mode changes; `atlasVisibility` resolves what actually draws.
  Illustration points never enter the measured catalogue or acquire measured status.
- Automatic display policy lives in Deep Field's `lib/model/atlas-mode.ts`: Drift
  temporarily uses Illustration, Guide uses Both, and both suppress full-map guides.
  Their captions identify the presentation. The store restores the original manual
  mode and filters on exit, including a handoff from one experience to the other.

## Updating safely

1. Review the journal and archive records. Update the versioned URL, publication
   state and `REVIEWED` in `scripts/fetch-cosmic-data.mjs`; do not use a floating
   arXiv URL. If an unversioned archive file changed, use a fresh `--cache` directory.
2. Run the importer. It checks expected table lengths/schema, validates HTTP ranges,
   caches downloads and retries transient failures. If a table changed, inspect it
   before changing the assertions. All output is written only after imports succeed.
3. Inspect the source hashes, selection counts, coordinate units and known anchors.
   Update this file and `atlas.ts`/`atlas-facts.ts` only where conventions or literature
   facts changed. Source statuses displayed in the cards come from the manifest.
4. Keep shared body names and Deep Field messages synchronized in English and Czech.
   Add facts to the catalogue, then quote them through card refs or `PROSE_FIGURES`.
5. Run `npm run docs:catalogue`, formatting, `npm run typecheck`, `npm test`,
   `npm run lint`, `npm run build` and `npm run test:bundles`. The atlas tests protect
   coordinate transforms, real catalogue geometry, source distinctions and visibility.

Large CF4/DESI tables are imported only by `graphics/atlas.ts`; do not import them
from card catalogues, metadata, or the home catalogue. No live service is required.
