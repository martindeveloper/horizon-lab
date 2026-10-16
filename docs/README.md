---
title: Documentation
description: Guides for working on Horizon, its shared toolkit and the science behind its simulations.
sidebar_position: 0
tags: [index]
---

# Documentation

Guides for working on Horizon. Start with the architecture, then the area you are changing.

## Guides

| Guide                                                   | What it covers                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| [Architecture](architecture.md)                         | Ownership, routes, messages, bundles, loading; adding a simulation |
| [UI library](ui-library.md)                             | Shared components, styling contract, themes, accessibility, chrome |
| [Branding and metadata](branding.md)                    | Brand assets, share cards, page metadata, crawler files            |
| [Science source ledger](science-sources.md)             | Every physical number shown, where it lives and its source         |
| [Black-hole physics audit](black-hole-physics-audit.md) | What the observatory computes exactly, approximates and corrected  |

## Elsewhere in the repository

| Document                                                       | What it covers                                     |
| -------------------------------------------------------------- | -------------------------------------------------- |
| [Toolkit](../packages/toolkit/README.md)                       | `@horizon/toolkit` modules and reuse in other apps |
| [Black-hole observatory](../src/features/black-hole/README.md) | Presets, model and sources (generated)             |
| [Rendering bench](../bench/README.md)                          | Headless GPU benchmark and frame grabs             |
| [Project README](../README.md)                                 | Overview, quick start and scripts                  |

Every page starts with front matter. `title`, `description` and `tags` are read by most
Markdown site generators (Docusaurus, VitePress, Starlight, MkDocs Material); `sidebar_position`
orders the pages in Docusaurus. GitHub shows the front matter as a small table above the page.
