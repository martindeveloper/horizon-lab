# Third-party notices

Run `npm run licenses:generate` after installing dependency updates and commit
`public/THIRD-PARTY-NOTICES.txt`. `npm test` and `npm run licenses:check` reject
stale notices. The credits page links to this file in both languages.

The generator copies licence, copyright, OFL and NOTICE files verbatim from
platform-independent production dependencies in `package-lock.json`, including
nested bundled components (for example, Next.js's compiled dependencies).
It deliberately includes server-only dependencies too; it is not a bundle-size
inventory. Native/optional build and server binaries and the SWC download counter
are excluded. Reassess those licences separately if distributing server binaries.

Some npm tarballs omit their licence file:

- `@next/env` uses the Next.js repository licence shipped in `next`.
- `babel-plugin-react-compiler` and `client-only` use the React repository
  licence shipped in `react`.
- `@schummar/icu-type-parser` uses `icu-type-parser-LICENSE.txt`, copied from
  <https://raw.githubusercontent.com/schummar/schummar-translate/master/LICENSE>
  on 2026-10-18 for installed version 1.21.5. Review this upstream licence when
  updating that dependency.

Music provenance remains unconfirmed by the owner; these notices do not establish
rights to the ambient track. Imagery attribution lives separately in
`public/textures/orrery/CREDITS.md` and on `/credits`.
