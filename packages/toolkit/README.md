# Horizon toolkit

Reusable pieces for interactive scientific visualizations. Start here when you
want the Horizon interface or rendering infrastructure in another project.
Black-hole physics, presets, copy, routing, and Zustand stores are deliberately
outside this package.

## Finding the right module

| Import                             | Owns                                                                   | Runtime dependencies                                      |
| ---------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `@horizon/toolkit/ui`              | Controls, surfaces, equations, loading, dialogs, technical documents   | React; Radix Slider; Lucide; class utilities              |
| `@horizon/toolkit/ui/motion`       | `TextReveal`, `textStagger`                                            | React, Motion                                             |
| `@horizon/toolkit/math`            | Clamp, wrap, easing, log sliders, seeded random, CPU value noise       | None                                                      |
| `@horizon/toolkit/science`         | Constants, units, measures, equations, distance readouts, Julian dates | None                                                      |
| `@horizon/toolkit/camera`          | Camera snapshots, screen projection, orbit input, flight interpolation | DOM only when creating input controls                     |
| `@horizon/toolkit/rendering`       | Shader pass, engine host, frame loop, sizing, power hints, WebGL probe | Three.js; DOM only when creating a renderer/observer/loop |
| `@horizon/toolkit/audio`           | Looping background music with fades and gapless crossfade              | Web Audio and `<audio>`, only once playing                |
| `@horizon/toolkit/bench`           | Benchmark contract, in-page WebGL 2 runner, frame grab, statistics     | None; DOM and WebGL only when a scene runs                |
| `@horizon/toolkit/environment`     | Shared media queries: reduced motion, fine and coarse pointers         | None; reads `matchMedia` only when called                 |
| `@horizon/toolkit/storage`         | One session or local value: lifetime, decay, and a decode-once codec   | None; reads web storage only when a cell is called        |
| `@horizon/toolkit/bodies`          | Sun, planets, moons: orbits, figures, IAU spin, rings, map credits     | None                                                      |
| `@horizon/toolkit/bodies/surfaces` | Painted equirectangular body maps, albedos                             | None                                                      |
| `@horizon/toolkit/shaders`         | GLSL snippets and build-time includes                                  | Bundler text imports                                      |

There is intentionally no root barrel exporting everything. UI does not import
Three.js or shader code. Camera and numerical functions can be tested without a
GPU. Importing modules never starts a loop or creates a WebGL context.

Directory READMEs describe the contracts:
[UI](src/ui/README.md), [math](src/math/README.md), [science](src/science/README.md),
[camera](src/camera/README.md), [rendering](src/rendering/README.md),
[shaders](src/shaders/README.md), [audio](src/audio/README.md), [bench](src/bench/README.md),
[environment](src/environment/README.md), [storage](src/storage/README.md),
[bodies](src/bodies/README.md).

## Using it in this repository

This is an npm workspace. `npm ci` links it automatically. App code imports the
public paths above; toolkit files use relative imports and cannot import `@/`,
Next.js, next-intl, Zustand, or another feature's code.

```tsx
import { fromLogFraction } from "@horizon/toolkit/math";
import { Surface, ControlRow, Slider } from "@horizon/toolkit/ui";
```

The concrete consumer is `src/features/black-hole/lib/engine.ts`. It supplies
uniforms, integration budgets, camera limits and simulation state to the shared
infrastructure. The React adapter in `components/scene-camera.tsx` provides one
camera snapshot per mounted observatory.

## Using it in another project

The package ships TypeScript/TSX and CSS/GLSL source for modern bundlers. It is
not a precompiled Node.js library. It has not been published to a registry.
Create a local tarball with `npm pack --workspace @horizon/toolkit` and install
that tarball in another project, or copy the workspace package. No app directory
is needed. Install the optional peers used by your entry points: React/React DOM
and Radix Slider for UI, Motion for animated text, and Three.js for rendering.
Separate entry points keep those runtimes out of math-only application bundles.
TypeScript consumers also need the relevant `@types/react`, `@types/react-dom`
and `@types/three` packages for the entry points they use.

For Next.js, add `transpilePackages: ["@horizon/toolkit"]`. If using shaders,
also configure the build-time shader loader:

```ts
const nextConfig = {
  transpilePackages: ["@horizon/toolkit"],
  turbopack: {
    rules: {
      "*.glsl": { loaders: ["@horizon/toolkit/shaders/loader"], as: "*.js" },
    },
  },
};
```

The loader also works as a Webpack loader and emits a JavaScript string export.
It tracks included files as build dependencies. Other bundlers can adapt the
pure preprocessor; `assembleShader` remains an in-memory adapter for tests.
See the shader module README for syntax and source diagnostics.

For Tailwind CSS v4, import styles and register the installed source relative to
your stylesheet (adjust `../node_modules` to its actual location):

```css
@import "tailwindcss";
@import "@horizon/toolkit/theme.css";
@import "@horizon/toolkit/styles.css";
@source "../node_modules/@horizon/toolkit/src/ui";
@source not "../node_modules/@horizon/toolkit/src/ui/examples";
```

`base.css` is a separate **opt-in** document baseline: it changes body colors,
fonts, overscroll, button cursors and text wrapping. Import it only when the
host application wants those global rules. Fonts are not fetched by the package;
use the supplied fallback stacks or load the fonts in your application. The font
tokens name the Fontsource variable families first ("IBM Plex Sans Variable",
"Bodoni Moda Variable") and the static families after; Horizon bundles them from
npm in its locale layout. The
host also owns theme selection, localization, brand names and navigation.

## Validation

From the repository root:

```sh
npm run typecheck --workspace @horizon/toolkit
npm test
npm run lint
npm run build
npm run test:bundles
npm pack --workspace @horizon/toolkit --dry-run
```

`tests/toolkit-*.test.mjs`, one file per module, cover numerical boundaries,
projection/ray agreement, camera independence, pointer transitions, frame
lifecycle, cleanup, shader assembly and package boundaries. Bundle tests ensure
the catalogue does not load WebGL or feature shaders. These are code/build
checks, not GPU render or browser interaction tests.

When adding exports, keep functions small and name their units and assumptions.
Add a consumer before generalizing feature-specific behavior. Update the relevant
module README and tests with the public contract.
