import { register } from "node:module";

/** Registers `glsl-hooks.mjs` for the test run (`node --import ./tests/glsl-register.mjs`). */
register("./glsl-hooks.mjs", import.meta.url);
