# GLSL snippets

`@horizon/toolkit/shaders` exports source strings; configure the `.glsl` build loader
in the consumer's bundler. Individual assets are also exported under
`@horizon/toolkit/glsl/*`. Snippets do not read application uniforms.

| Export             | GLSL functions                       | Contract                                                                                                                                                          |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mathGLSL`         | `PI`, `TWO_PI`, `HALF_PI` macros     | Guarded `#define`s, so three.js's `<common>` can coexist; include as `<horizon/math>`                                                                             |
| `fullscreenVertex` | `main`                               | Full-screen PlaneGeometry vertex positions; passes vUv                                                                                                            |
| `noiseGLSL`        | `hash13`, `hash21`, `value2`, `fbm2` | Deterministic procedural hashes/value noise; fBm has three fixed octaves                                                                                          |
| `temperatureGLSL`  | `blackbody`                          | Approximate temperature-to-RGB mapping; input Kelvin clamped to 1000–40000; not a spectral radiance calculation                                                   |
| `starsGLSL`        | `fieldStars`, `gaussDir`             | Procedural directional star field; depends on noiseGLSL; explicit intensity, pixel angle and optional lensed spread (radians) keep stars a pixel wide, no flicker |
| `tonemapGLSL`      | `tonemap`                            | Fitted rational filmic curve with explicit exposure; output clamped [0,1]; not a full color-management pipeline                                                   |

## Build-time includes

Configure the public `@horizon/toolkit/shaders/loader` in your bundler (see the
package README). Next.js uses it directly in Turbopack's `*.glsl` rule; `next build`
needs no prebuild script, generated files, or runtime assembly. The loader emits
an ordinary JavaScript string export and registers every included file as a
build dependency, including nested files.

```glsl
#include <horizon/stars>
#include <horizon/seeded-hash>
#include "./local-helper.glsl"
```

- Named includes resolve within the toolkit shader directory, without `.glsl`.
  Quoted includes require `./` or `../` and a `.glsl` extension, relative to their
  importing file. There is no network lookup or arbitrary package resolution.
- Includes expand recursively in source order, once per canonical file in each
  entry shader. `stars` includes its own `noise` dependency. Diamond dependencies
  do not duplicate function definitions. Cycles fail with their include chain;
  nesting is limited to 64 files. Missing files report the importer and line.
- Put includes at top level before use, outside `#if`/`#ifdef` branches. Conditional
  includes are rejected because include-once would otherwise depend on macro
  evaluation. GLSL and Three.js retain ownership of macros and conditional code.
- Comments are ignored when recognizing directives. Three.js chunks such as
  `#include <common>` pass through unchanged. Helpers must not contain `#version`;
  the entry owns it. This is an include expander, not a GLSL parser or minifier.
- Expansion inserts GLSL ES `#line` directives with numeric source IDs and restores
  the importer line after each include. A trailing comment table maps IDs to
  project-relative paths in the emitted shader. GPU errors inside helpers can
  thus be traced to their source file. Three.js's injected prefix may still offset
  entry lines before the first include; this does not replace its shader log.

`assembleShader(source, snippets)` remains a pure in-memory adapter, using the
same expansion rules. Its map keys are the names after `horizon/`. Application
engines import already expanded shader strings and do not invoke it at runtime.

## Additional shared math

- `#include <horizon/seeded-hash>` provides `seededHash3(vec3 p, float seed)`:
  the original planetesimal sine hash, with its seed explicit rather than read
  from a varying. Used in both vertex displacement and fragment grain.
- `#include <horizon/sprite>` provides `pointGlow(vec2 pointCoord, float falloff)`:
  a round Gaussian point-sprite profile that is zero outside the sprite. Pass
  `gl_PointCoord`; star and swarm points share it with their own falloff.
- `fxaa.frag.glsl` and `resolve.frag.glsl` are the fragment shaders of the
  rendering module's FXAA and MSAA passes (`createFxaaPass`, `createMsaaPass`).
  Both read the offscreen frame as `uImage` with one pixel `uTexel`; it holds
  display-ready bytes, encoded as the canvas would be, so they write their result
  as it is and FXAA judges edges where they are seen. They draw with
  `fullscreen.vert.glsl`.
- `#include <horizon/supersample>` supplies `main()` for a full-screen ray shader
  that defines `vec3 shade(vec2 fragCoord, bool derivatives)`. Pass 0 traces one
  ray per pixel; pass 1 (`HORIZON_PASS 1`, compiled by `createFullscreenPass` with
  `supersample: true`) reads that frame through its own `uFirstPass` and
  `uFirstTexel` uniforms and adds four rotated-grid rays where a 3 × 3
  neighbourhood's luma spans at least `SUPERSAMPLE_EDGE` (default 0.04). Those
  rays get `derivatives = false` and must not use screen derivatives. Include it
  last, after `shade`.
- `#include <horizon/fresnel>` provides
  `fresnelRim(vec3 normal, vec3 viewDir, float power)`: the shared one-sided rim
  power curve. Both vectors must be normalized. This artistic factor is not
  physical Fresnel reflectance. The two-sided shell keeps its distinct formula.

Black-hole acceleration, spin correction, disk emission, capture conditions,
sky presets and step sizes remain in the feature shader. The final highlight
boost, vignette and dithering also stay with its artistic pipeline. Importing a
snippet does not imply scientifically calibrated rendering.

## Parameters from TypeScript

Numbers a shader needs live once in TypeScript (the science library or a lab's
`parameters.ts`), where tests check them. `@horizon/toolkit/shaders/defines`
(no GLSL imports, safe in Node) turns them into a committed, generated GLSL
header that the shader includes, the pattern engines use for generated shader
headers:

```ts
import { glslDefines, glslHeader, glslInt } from "@horizon/toolkit/shaders/defines";

const defines = glslDefines({ DISK_PEAK_K: 15_800, MAX_STEPS: glslInt(180), TINT: [1, 0.97, 0.9] });
glslHeader(defines, {
  guard: "LAB_PARAMETERS",
  source: "lib/parameters.ts",
  command: "npm run shaders:generate",
});
// #ifndef LAB_PARAMETERS … #define DISK_PEAK_K 15800.0 … #define MAX_STEPS 180 … #endif
```

```glsl
#include <horizon/math>              // PI, TWO_PI, HALF_PI (guarded: three.js's <common> has PI)
#include "./parameters.generated.glsl"
```

- The header is a real file: editors, linters and offline compilers see every
  name, and the shader source is complete without runtime injection.
- `glslFloat` always writes a decimal point or exponent (10 significant digits,
  no locale); `glslInt` marks loop bounds and counts; 2–4 numbers become a vector.
  Names are UPPER_SNAKE_CASE and carry the shader's prefix to avoid collisions.
- The app regenerates headers with `npm run shaders:generate`; `npm run
  shaders:check` and `npm test` fail when a header is stale.
- `glslDefines` output also works as `ShaderMaterial.defines` (and
  `createFullscreenPass({ defines })`) for values chosen when a material is
  created. Defines are compile-time: anything that changes while the scene runs
  stays a uniform.

## Offline validation

`tests/shader-validation.test.mjs` expands every application shader with this
loader, adds three.js's WebGL 2 prefix (built-in uniforms and attributes, GLSL 1
→ 3 aliases), resolves macros and parses it with `@shaderfrog/glsl-parser`,
treating undeclared variables and functions as errors. It catches syntax errors
and missing defines without a browser; it is not a type checker.
