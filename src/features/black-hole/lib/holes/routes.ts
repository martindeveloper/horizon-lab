/**
 * The observatory's addresses: each preset's id in picker order (real objects by mass, then
 * theory), the other names that reach it, and the default. Imports nothing, so next.config.ts,
 * which resolves no path aliases, can read it through routing.ts for the redirects.
 */
export const HOLE_ROUTES = [
  { id: "stellar", aliases: ["stellar", "cygnus-x-1", "cyg-x-1", "cygnus"] },
  { id: "gaia-bh3", aliases: ["gaia-bh3", "gaiabh3", "bh3"] },
  { id: "gw231123", aliases: ["gw231123", "gw-231123"] },
  { id: "omega-cen", aliases: ["omega-cen", "omega-centauri", "omegacen", "ngc-5139"] },
  { id: "sgr-a", aliases: ["sgr-a", "sgra", "sagittarius-a", "sagittarius-a-star"] },
  { id: "m87", aliases: ["m87", "m87-star", "messier-87", "powehi", "pōwehi"] },
  { id: "ton-618", aliases: ["ton-618", "ton618"] },
  { id: "lensed", aliases: ["lensed", "disk"] },
  { id: "schwarzschild", aliases: ["schwarzschild"] },
  { id: "kerr", aliases: ["kerr", "extreme-kerr"] },
] as const;

export type PresetId = (typeof HOLE_ROUTES)[number]["id"];

export const PRESET_IDS: readonly PresetId[] = HOLE_ROUTES.map((route) => route.id);
export const DEFAULT_PRESET_ID: PresetId = "lensed";

/** Every other name a preset answers to, by name. The custom scene has no address of its own. */
export const HOLE_ALIASES: Readonly<Record<string, PresetId>> = Object.fromEntries(
  HOLE_ROUTES.flatMap((route) => route.aliases.map((alias) => [alias, route.id])),
);
