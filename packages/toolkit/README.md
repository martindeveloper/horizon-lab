# Horizon toolkit

Reusable pieces for interactive scientific visualizations. Start here when you
want the Horizon interface or rendering infrastructure in another project.
Black-hole physics, presets, copy, routing, and Zustand stores are deliberately
outside this package.

## Finding the right module

| Import                               | Owns                                                                                                                                           | Runtime dependencies                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `@horizon/toolkit/ui`                | Controls, surfaces, equations, loading, dialogs, technical documents                                                                           | React; Radix Slider; Lucide; class utilities              |
| `@horizon/toolkit/ui/motion`         | `TextReveal`, `textStagger`                                                                                                                    | React                                                     |
| `@horizon/toolkit/math`              | Clamp, wrap, easing, log sliders, seeded random, CPU value noise, `Vec3` tuple helpers                                                         | None                                                      |
| `@horizon/toolkit/science`           | Constants, units, equations, readouts, Julian dates, sky coordinates, spectra, colour, periodic table                                          | None                                                      |
| `@horizon/toolkit/camera`            | Camera snapshots, screen projection, orbit and flight input, free poses and matrices, flight interpolation, views                              | DOM only when creating input controls                     |
| `@horizon/toolkit/rendering`         | Shader pass, composite (MSAA, FXAA, bloom, lens) passes, engine host, frame loop, sizing, power hints, WebGL probe                             | Three.js; DOM only when creating a renderer/observer/loop |
| `@horizon/toolkit/rendering/quality` | `RENDER_QUALITIES` and `RenderQuality`, the four levels, without the Three.js barrel                                                           | None                                                      |
| `@horizon/toolkit/scene`             | Scene host with switchable anti-aliasing, bloom and lens, orbit rig and input, labels, taps, rulers, HUD readouts, map loader, floating origin | Three.js; DOM and WebGL only when a host or labels start  |
| `@horizon/toolkit/audio`             | Background music and playlists with fades and gapless crossfade                                                                                | Web Audio and `<audio>`, only once playing                |
| `@horizon/toolkit/bench`             | Benchmark contract, in-page WebGL 2 runner, frame grab, statistics                                                                             | None; DOM and WebGL only when a scene runs                |
| `@horizon/toolkit/environment`       | Shared media queries: reduced motion, pointers, the wide layout                                                                                | None; reads `matchMedia` only when called                 |
| `@horizon/toolkit/storage`           | One session or local value: lifetime, decay, and a decode-once codec                                                                           | None; reads web storage only when a cell is called        |
| `@horizon/toolkit/worker`            | A pure computation on a module worker, its arrays transferred, in place where no worker starts                                                 | None; starts a `Worker` only when a task runs             |
| `@horizon/toolkit/records`           | Typed keys and records without casts: `keysOf`, `recordFrom`, `recordBy`, `partialFrom`, `includesId`                                          | None                                                      |
| `@horizon/toolkit/bodies`            | Sun, planets, moons: orbits, figures, masses, spin, rings, Sun/Moon almanac                                                                    | None                                                      |
| `@horizon/toolkit/bodies/surfaces`   | Painted equirectangular body maps, albedos                                                                                                     | None                                                      |
| `@horizon/toolkit/shaders`           | GLSL snippets and build-time includes                                                                                                          | Bundler text imports                                      |
| `@horizon/toolkit/shaders/defines`   | `glslDefines`, `glslHeader`: numbers handed to GLSL as `#define`s from the TypeScript that owns them                                           | None                                                      |
| `@horizon/toolkit/glsl/*`            | One snippet's source file (`glsl/temperature`), for a loader that resolves `#include <horizon/…>`                                              | Bundler text imports                                      |
| `@horizon/toolkit/shaders/loader`    | The webpack/Turbopack loader that expands those includes                                                                                       | Node, at build time                                       |

There is intentionally no root barrel exporting everything. UI does not import
Three.js or shader code. Camera and numerical functions can be tested without a
GPU. Importing modules never starts a loop or creates a WebGL context.

Directory READMEs describe the contracts:
[UI](src/ui/README.md), [math](src/math/README.md), [science](src/science/README.md),
[camera](src/camera/README.md), [rendering](src/rendering/README.md), [scene](src/scene/README.md),
[shaders](src/shaders/README.md), [audio](src/audio/README.md), [bench](src/bench/README.md),
[environment](src/environment/README.md), [storage](src/storage/README.md),
[worker](src/worker/README.md), [bodies](src/bodies/README.md).

## External URLs (`@horizon/toolkit/urls`)

`src/urls.ts` centralizes external destinations used by executable code: scientific
references, attribution and licence links, source downloads, and Horizon deployment
defaults. Its named constant groups have no dependencies or environment reads, so
Node scripts and browser code can share them without loading rendering modules.
Consumers retain environment overrides and construct request paths and queries.
Documentation, generated datasets, third-party licence text, SVG namespaces and
the benchmark’s local intercepted origin are not external link configuration.

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
and Radix Slider for UI, and Three.js for rendering. Animated text uses CSS.
Separate entry points keep those runtimes out of math-only application bundles.
TypeScript consumers also need the relevant `@types/react`, `@types/react-dom`
and `@types/three` packages for the entry points they use.

For Next.js, add `transpilePackages: ["@horizon/toolkit"]`. If using shaders or
`@horizon/toolkit/rendering` (its post passes import `.glsl` files), also
configure the build-time shader loader:

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
Node has no bundler: this repository's tests run with
`--import ./tests/glsl-register.mjs`, a module hook that loads `.glsl` through
the same loader.
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

`scene.css` styles the labels of `@horizon/toolkit/scene`; import it from the
routes that draw a scene rather than globally.

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

`tests/toolkit-*.test.mjs` cover math, science, camera, rendering, scene, shaders,
environment and the package exports: numerical boundaries, projection/ray
agreement, camera independence, pointer transitions, frame lifecycle, cleanup,
shader assembly and package boundaries. `tests/music.test.mjs`,
`tests/storage.test.mjs`, `tests/toolkit-worker.test.mjs`, `tests/bench*.test.mjs` and
`tests/bodies.test.mjs` (with `astronomy`, `sky`, `maps` and `moon-maps`) cover audio,
storage, workers, bench and bodies. `tests/ui-motion.test.mjs` covers exit completion/cancellation, CSS timing reads and HUD readiness;
`tests/i18n-theme.test.mjs`
checks their theme contrast. Bundle tests ensure the catalogue does not load
WebGL or feature shaders. These are code/build checks, not GPU render or
browser interaction tests.

When adding exports, keep functions small and name their units and assumptions.
Add a consumer before generalizing feature-specific behavior. Update the relevant
module README and tests with the public contract.

## License

[MIT](LICENSE), except the third-party code listed in [NOTICE](NOTICE.md).
