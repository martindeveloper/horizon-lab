# Horizon

Interactive simulation catalogue built with React, Three.js, Next.js App Router,
TypeScript, and Tailwind CSS. Deploys with Vercel’s native Next.js integration.

- Preserve the simulation, localization, and existing application design.
- Routes and server metadata live in `src/app/`; static assets live in `public/`.
- Keep shared chrome in the locale layout and the observatory in its own black-hole layout so preset navigation preserves the canvas.
- The WebGL observatory loads through a client-only dynamic boundary; browser-derived stores must not render on the server.
- No authentication or database is required.
- Use `@horizon/toolkit/storage` for web storage; it stores keys as `horizon:<key>[:<subkey>]`.
- Run `npm run typecheck` and `npm run build` after code changes.
- Tests must protect real logic or behavior, not page copy, source-code patterns, or implementation details. Avoid duplicate tests.
- Start servers or run browser checks only when the user requests them.

- Reuse `@horizon/toolkit/ui` and its theme tokens for new visualization interfaces.
- Read `docs/ui-library.md` before extending shared UI. Keep domain state, routing,
  and translated copy out of the library; preserve existing component styling.

- Use next-intl with `useTranslations` and `@/i18n/navigation`. URLs never carry
  the language: the `NEXT_LOCALE` cookie picks it, English is the default, and static
  rewrites in `src/lib/redirects.ts` map clean paths to the prerendered `/en` or `/cs`
  pages. Keep both message catalogs in sync; do not add locale state to localStorage
  or Zustand. Translate visible UI copy and accessibility labels. Keep page/social
  metadata and share images in English; canonical URLs carry no language.
- The change log is Markdown, one file per language in `src/content/changelog/`, not message
  keys. Add a release to every language at once, newest first, in the format
  `src/lib/changelog.ts` documents.
- Use next-themes for theme state. Dark is the default; light mode changes UI
  materials while `bg-space`/`text-space-fg` preserve the dark astronomical scene.
- Run `npm test` for translation, routing, and contrast checks as well.
- Messages stay untyped for next-intl: shared components take a lab's namespace, which typed
  keys cannot represent. Guard placeholders with strict render tests (`onError` throws) over
  every message that quotes figures, in both languages.

- Keep the standard `next build`; prerender known locales and presets at build time.
- Do not add request-time proxy, dynamic fallback routes, or server-only caching.
- Preserve native Next.js legacy/alias redirects in `src/lib/redirects.ts`.

- Use Oxlint (`npm run lint`) and Oxfmt (`npm run format` / `npm run format:check`).
- Keep React Hooks and compiler correctness checks enabled; do not add ESLint or Prettier.
- Avoid deeply nested ternaries. Always use braces for control-flow bodies.
- Prefer `switch` over long `if`/`else if` chains when comparing one value against discrete cases.

- Read `docs/architecture.md` before adding a simulation. Keep each sub-app under
  `src/features/<slug>`; expose only its entry component, manifest, routing, and
  server helpers. Shared code must not import feature stores or renderers.
- Body data has one home: generic bodies and constants in `@horizon/toolkit/bodies` and
  `/science`, named stars, holes and the shared worlds in `src/space/`, a lab's own
  literature figures in its feature catalogue. Never retype a value a catalogue holds;
  derive what follows from it with the kit's laws. Every figure names a source and status.
- Catalogue a number when more than one lab uses it, code computes with it, it is a
  revisable measurement, or it derives from other figures. A one-off literature number
  used once may stay in the copy; do not catalogue formulas, years or vague phrases.
- Copy quotes catalogued figures as placeholders (`proseArgs`, `quoteAs` for how a sentence
  prints one), never typed digits; print catalogue figures through `formatFigure`, not a local
  formatter. Names of catalogued bodies come from the shared `names.<id>`. A word whose form
  depends on a number takes `{<name>Plural, select, one {…} few {…} many {…} other {…}}` in its
  sentence's case; live readouts pass the same category (`pluralOf`).
- The catalogue must not mount WebGL or load simulation-specific message packs.
- Keep catalogue pages scrollable; size simulation stages beneath the common header.

- Shared reusable code lives in `packages/toolkit/`; read its README and module
  README before changing a public contract. Use public `@horizon/toolkit/*`
  imports from the app. Never import app aliases, routing, stores or translations
  into the package. Keep UI imports independent of rendering and shader imports.
- Verify shared changes with `npm run typecheck --workspace @horizon/toolkit`,
  `npm test`, and `npm run test:bundles` after the application build.
