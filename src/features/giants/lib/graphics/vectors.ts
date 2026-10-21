import { Vector4 } from "three";

/** A uniform array of `count` vectors, the slots the shader reads (`uShape`, `uRegion`, …). */
export const vectors = (count: number) => Array.from({ length: count }, () => new Vector4());
