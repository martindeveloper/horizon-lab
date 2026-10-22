/**
 * The hedgerow's density volume as a host draws it: baked once per device class on a worker
 * (`density.worker.ts`; in place without one) and kept, so switching a prominence on again
 * attaches at once. A failed bake is not kept, so the next request tries again.
 */
import { Data3DTexture, LinearFilter, RedFormat } from "three";

import { workerTask } from "@horizon/toolkit/worker";

import { createProminenceDensity, type DensityVolume } from "./density";

const baker = workerTask<boolean, DensityVolume>(
  () => new Worker(new URL("./density.worker.ts", import.meta.url), { type: "module" }),
  createProminenceDensity,
);

const baked = new Map<boolean, Promise<DensityVolume>>();

/** The baked volume for a device class, off the main thread once; rejects when the bake fails. */
export function prominenceDensity(tight: boolean) {
  let volume = baked.get(tight);
  if (!volume) {
    const baking = new Promise<DensityVolume>((resolve, reject) =>
      baker.run(tight, resolve, reject),
    );
    baking.catch(() => {
      if (baked.get(tight) === baking) baked.delete(tight);
    });
    baked.set(tight, baking);
    volume = baking;
  }
  return volume;
}

/** The volume as the shaders sample it: one channel, linearly filtered. The caller owns it. */
export function prominenceTexture({ data, width, height, depth }: DensityVolume) {
  const texture = new Data3DTexture(data, width, height, depth);
  texture.format = RedFormat;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
