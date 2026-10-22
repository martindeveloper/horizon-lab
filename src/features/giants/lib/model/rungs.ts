/** One ordered entry per rung. Routes read this without loading scientific catalogues. */
import { bodyKey, type BodyRef } from "../../../../space/body-reference";
import type { Style } from "../parameters";
import type { ActivityKind } from "./activity";

export type RungKind = "star" | "remnant" | "planet" | "horizon";
export type Fate = "whiteDwarf" | "neutronStar" | "blackHole" | "neutronOrHole";
export type RungLabel = "pulsar" | "whiteDwarf" | "brownDwarf";
export type Ring = { glow: number; kelvin: number; flicker: number; brightest: number };

/** Illustrative appearance choices, separate from each body's catalogued measurements. */
type Presentation = {
  profile?: Style;
  activity?: ActivityKind;
  haze?: number;
  pulse?: number;
  giantCells?: boolean;
  ring?: Ring;
  /** Use the catalogued inclination rather than an illustrative orientation. */
  measuredTilt?: boolean;
};
type Definition = {
  id: string;
  body: BodyRef;
  kind: RungKind;
  label?: RungLabel;
  fate?: Fate;
  /** A generic teaching example keeps its lab-owned name. */
  ownName?: boolean;
  presentation?: Presentation;
};

/** Smallest to largest; this order also preserves the surfaces' seeds and camera stops. */
const ENTRIES = [
  {
    id: "neutron-star",
    body: { catalogue: "stars", id: "psr-j0030" },
    kind: "remnant",
    label: "pulsar",
    ownName: true,
    presentation: { profile: "pulsar" },
  },
  {
    id: "cygnus-x1",
    body: { catalogue: "holes", id: "cygnus-x1" },
    kind: "horizon",
    presentation: {
      profile: "horizon",
      ring: { glow: 1, kelvin: 14_000, flicker: 0.4, brightest: Math.PI },
    },
  },
  {
    id: "sirius-b",
    body: { catalogue: "stars", id: "sirius-b" },
    kind: "remnant",
    label: "whiteDwarf",
    presentation: { profile: "whiteDwarf" },
  },
  {
    id: "earth",
    body: { catalogue: "planets", id: "earth" },
    kind: "planet",
    presentation: { profile: "earth" },
  },
  {
    id: "brown-dwarf",
    body: { catalogue: "stars", id: "lhs-6343-c" },
    kind: "star",
    label: "brownDwarf",
    presentation: { profile: "brownDwarf" },
  },
  {
    id: "jupiter",
    body: { catalogue: "planets", id: "jupiter" },
    kind: "planet",
    presentation: { profile: "jupiter" },
  },
  {
    id: "trappist-1",
    body: { catalogue: "stars", id: "trappist-1" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { activity: "flare" },
  },
  {
    id: "proxima",
    body: { catalogue: "stars", id: "proxima" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { activity: "flare" },
  },
  {
    id: "sun",
    body: { catalogue: "stars", id: "sun" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { activity: "solar" },
  },
  { id: "sirius", body: { catalogue: "stars", id: "sirius" }, kind: "star", fate: "whiteDwarf" },
  {
    id: "vega",
    body: { catalogue: "stars", id: "vega" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { measuredTilt: true },
  },
  {
    id: "achernar",
    body: { catalogue: "stars", id: "achernar" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { pulse: 0.04, measuredTilt: true },
  },
  {
    id: "sgr-a",
    body: { catalogue: "holes", id: "sgr-a" },
    kind: "horizon",
    presentation: {
      profile: "horizon",
      ring: { glow: 0.45, kelvin: 4_200, flicker: 1, brightest: Math.PI },
    },
  },
  {
    id: "arcturus",
    body: { catalogue: "stars", id: "arcturus" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { haze: 0.2, activity: "quiet" },
  },
  {
    id: "r136a1",
    body: { catalogue: "stars", id: "r136a1" },
    kind: "star",
    fate: "blackHole",
    presentation: { haze: 0.8, pulse: 0.05 },
  },
  {
    id: "aldebaran",
    body: { catalogue: "stars", id: "aldebaran" },
    kind: "star",
    fate: "whiteDwarf",
    presentation: { haze: 0.25, activity: "quiet" },
  },
  {
    id: "rigel",
    body: { catalogue: "stars", id: "rigel" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 0.4, pulse: 0.07 },
  },
  {
    id: "deneb",
    body: { catalogue: "stars", id: "deneb" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 0.5, pulse: 0.07 },
  },
  {
    id: "antares",
    body: { catalogue: "stars", id: "antares" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 0.9, activity: "plumes", giantCells: true },
  },
  {
    id: "betelgeuse",
    body: { catalogue: "stars", id: "betelgeuse" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 1, activity: "plumes", giantCells: true },
  },
  {
    id: "uy-scuti",
    body: { catalogue: "stars", id: "uy-scuti" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 1, activity: "plumes", giantCells: true },
  },
  {
    id: "vy-cma",
    body: { catalogue: "stars", id: "vy-cma" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 1, activity: "plumes", giantCells: true },
  },
  {
    id: "stephenson-2-18",
    body: { catalogue: "stars", id: "stephenson-2-18" },
    kind: "star",
    fate: "neutronOrHole",
    presentation: { haze: 1, activity: "plumes", giantCells: true },
  },
  {
    id: "m87",
    body: { catalogue: "holes", id: "m87" },
    kind: "horizon",
    presentation: {
      profile: "horizon",
      ring: { glow: 0.8, kelvin: 6_000, flicker: 0.3, brightest: -Math.PI / 2 },
    },
  },
  {
    id: "ton-618",
    body: { catalogue: "holes", id: "ton-618" },
    kind: "horizon",
    presentation: {
      profile: "horizon",
      ring: { glow: 1.4, kelvin: 22_000, flicker: 0.2, brightest: Math.PI },
    },
  },
] as const satisfies readonly Definition[];

export type RungId = (typeof ENTRIES)[number]["id"];
export type Rung = Omit<Definition, "id"> & { id: RungId };
export const RUNGS: readonly Rung[] = ENTRIES;
export const RUNG_IDS = ENTRIES.map(({ id }) => id);
export const DEFAULT_RUNG: RungId = "sun";
export const rungIndex = (id: RungId) => RUNG_IDS.indexOf(id);
export function rungById(id: RungId): Rung {
  const rung = RUNGS.find((entry) => entry.id === id);
  if (!rung) throw new Error(`Unknown rung "${id}"`);
  return rung;
}

/** Resolve a plotted catalogue body back to the feature's own route identity. */
export function rungForBody(body: BodyRef): Rung | undefined {
  const key = bodyKey(body);
  return RUNGS.find((rung) => bodyKey(rung.body) === key);
}
