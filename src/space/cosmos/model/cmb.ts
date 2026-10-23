import type { Facts } from "@/lib/facts";

import source from "./data/cmb-source.json";

/** Pinned numerical data; refresh with scripts/fetch-cmb-data.mjs, never an invented fallback. */
export const CMB_SOURCE = source;
/** Fixed diverging display palette, shared by the legend and linear-light shader. */
export const CMB_PALETTE = { cool: "#457aad", neutral: "#5e666b", warm: "#d19652" };
export const CMB_FACTS = {
  colourLimit: {
    value: 300e-6,
    unit: "K",
    source: "horizon",
    status: "teaching-choice",
    note: "Symmetric false-colour saturation at ±300 microkelvin; stored temperatures are not clipped.",
  },
  planckPixel: {
    value: (360 * 60) / source.products.planck.width,
    unit: "arcmin",
    source: "horizon",
    status: "derived",
    note: "Longitude spacing of the downsampled Planck display, not the native instrument beam.",
  },
  actPixel: {
    value: (360 * 60) / source.products.act.width,
    unit: "arcmin",
    source: "horizon",
    status: "derived",
    note: "Longitude spacing of the downsampled ACT display, not the native instrument beam.",
  },
} as const satisfies Facts;
export type CmbProduct = "planck" | "act";
export type CmbLoadState = "idle" | "loading" | "ready" | "error";
export type CmbStatus = Record<CmbProduct, CmbLoadState>;
export const CMB_INITIAL_STATUS: CmbStatus = { planck: "idle", act: "idle" };
/** Never call a component-separated CMB map raw measurement: photons are measured; maps reconstructed. */
export const CMB_EVIDENCE = "reconstructed";

export function decodeCmbPixel(r: number, g: number, mask: number): number | null {
  return mask === 255 ? (r * 256 + g - source.encoding.offset) * source.encoding.scale : null;
}

/** The shader's lookup convention, matching the atlas's Galactic (-cos l, sin b, sin l) frame. */
export function cmbMapUv([x, y, z]: readonly number[]): [number, number] {
  const radius = Math.hypot(x!, y!, z!);
  if (!(radius > 0) || !Number.isFinite(radius))
    throw new RangeError("CMB direction must be finite and nonzero");
  const longitude = Math.atan2(z!, -x!) / (2 * Math.PI);
  return [(longitude + 1) % 1, 0.5 - Math.asin(Math.max(-1, Math.min(1, y! / radius))) / Math.PI];
}

/** ACT only replaces valid pixels; no coverage or load failure falls back to valid Planck, then a mask. */
export function cmbPixelSource({
  planckValid,
  actValid,
  detail,
}: {
  planckValid: boolean;
  actValid: boolean;
  detail: boolean;
}): CmbProduct | null {
  if (detail && actValid) {
    return "act";
  }
  if (planckValid) {
    return "planck";
  }
  return null;
}

/** Resource state shared by the renderer and UI. A failed load is retried only on request. */
export function createCmbResources<T extends { dispose(): void }>(
  load: (product: CmbProduct) => Promise<T>,
  changed: (status: CmbStatus) => void,
) {
  const status = { ...CMB_INITIAL_STATUS };
  const resources: Partial<Record<CmbProduct, T>> = {};
  let disposed = false;
  const publish = () => changed({ ...status });
  const request = (product: CmbProduct) => {
    if (disposed || status[product] !== "idle") return;
    status[product] = "loading";
    publish();
    void load(product).then(
      (resource) => {
        if (disposed) {
          resource.dispose();
          return;
        }
        resources[product] = resource;
        status[product] = "ready";
        publish();
      },
      () => {
        if (disposed) return;
        status[product] = "error";
        publish();
      },
    );
  };
  return {
    resources,
    status: status as Readonly<CmbStatus>,
    request,
    retry: () => {
      if (disposed) return;
      for (const product of ["planck", "act"] as const)
        if (status[product] === "error") status[product] = "idle";
      publish();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      Object.values<T>(resources).forEach((resource) => resource.dispose());
    },
  };
}
