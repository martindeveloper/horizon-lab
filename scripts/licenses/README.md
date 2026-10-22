# Credits maintenance

`/credits` is the single public attribution page. Run `npm run credits:generate`
after updating dependencies or scientific source records. Commit the generated
`src/data/credits.generated.json`; do not edit it manually. `npm test` and
`npm run credits:check` detect stale output.

The generator collects upstream software notices, `docs/imagery-credits.md`,
`docs/science-sources.md`, the catalogue source registry, shared constants,
both technical bibliographies, and the acknowledgements here. These are internal
source records; the page renders them in expandable sections without client JS.
Original licence texts and citations stay in their published language.

The software inventory includes platform-independent production dependencies
and their bundled notices. Native/optional server binaries and the SWC download
counter are excluded; review those separately if distributing server binaries.

Some npm tarballs omit their licence file:

- `@next/env` uses the Next.js repository licence shipped in `next`.
- `babel-plugin-react-compiler` and `client-only` use the React repository
  licence shipped in `react`.
- `@schummar/icu-type-parser` uses `icu-type-parser-LICENSE.txt`, copied from
  <https://raw.githubusercontent.com/schummar/schummar-translate/master/LICENSE>
  on 2026-10-18 for installed version 1.21.5. Review this upstream licence when
  updating that dependency.

The blackbody shader also adapts Tanner Helland's temperature-to-RGB algorithm.
`tanner-helland-LICENSE.txt` was copied verbatim on 2026-10-18 from
<https://raw.githubusercontent.com/tannerhelland/vb6-code/master/LICENSE.md>,
the licence linked by <https://tannerhelland.com/code.html>. It is included even
though this code is not an npm dependency.

`scientific-acknowledgements.txt` preserves the GWOSC acknowledgement and data terms.

The offline CMB importer adapts the HEALPix coordinate algorithm used by
Astropy from Astrometry.net. `astrometry-net-LICENSE.txt` was copied verbatim on
2026-10-23 from
<https://raw.githubusercontent.com/astropy/astropy-healpix/main/cextern/astrometry.net/LICENSE>.
The notice is included in generated credits; the importer needs no Python packages.
