---
title: Branding and metadata
description: Brand assets, social share cards, page metadata and crawler files, and how to add them for a new simulation.
sidebar_position: 3
tags: [branding, seo, open-graph, metadata]
---

# Branding and metadata

Horizon is the catalogue brand. Each simulation gets its own illustration and
English title within the same composition: sunrise mark, serif heading, warm
gold, off-white text, and an ink background.

## Assets

- `public/favicon.svg`: shared Horizon mark; `favicon.ico`, `apple-touch-icon.png` and
  `icons/icon-{192,512}.png` are generated from it for the web app manifest.
- `public/social/horizon.png`: catalogue share cards.
- `public/simulations/black-hole/og.png`: observatory share cards.
- `public/simulations/orrery/og.png`: orrery share cards.
- `public/simulations/black-hole.svg`, `public/simulations/orrery.svg`: catalogue
  illustrations, reused in the cards.

The adjacent SVGs are editable vector exports. Regenerate all cards with
`npm run assets:generate`; commit both SVG and PNG outputs. The shared composition
and English captions live in `scripts/generate-social-assets.mjs`; simulation
headings come from the English message catalogue. Rasterization uses Sharp and the host's
Georgia/Arial font fallbacks, so regenerate the complete set on the same machine
for consistent typography. Cards are 1200 × 630 PNGs for social crawler support.

## Route metadata

`src/lib/metadata.ts` builds complete page metadata, including the canonical
URL, Open Graph URL, site name, locale, title, description, image and
Twitter large-image cards. Each page calls it explicitly because Next.js replaces
nested metadata objects instead of merging their fields.

The catalogue uses the global card. Each simulation's pages use its own card;
preset and view pages have their own titles and canonical URLs with that card.
All locales share English metadata and one English image per app. Adding a UI
translation does not require new social assets or metadata copy. Every language
shares one canonical URL without a language prefix, so pages have no language links.

For a new simulation, add artwork and English card copy to the generator, then
export `simulationMetadata` from its pages with its route, message loader and image path;
the catalogue, about and credits pages call `pageMetadata` directly.
Keep feature assets under `public/simulations/<slug>/`.

`siteUrl()` in `src/config.ts` gives the metadata origin: `SITE_URL`, then
`VERCEL_PROJECT_PRODUCTION_URL`, then `https://horizon.martinpernica.xyz`, so local
builds render production URLs too. The locale layout owns this metadata base.
After `npm run build`, run `npm run test:bundles` to check rendered social tags
without starting a server or browser.

## Crawler files

`src/app/robots.ts`, `sitemap.ts` and `manifest.ts` are static metadata routes on
the same origin. The sitemap lists canonical clean paths from the simulation
registry and each feature's routing helpers (`src/lib/sitemap.ts`); registering a
simulation fails typecheck until its subpages are listed there.
