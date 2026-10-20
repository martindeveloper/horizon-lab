/**
 * The solar system as one scene unit: the Sun, the planets and named bodies on their orbits,
 * the moons, the small-body populations and the reticle on the selection. A host engine
 * builds it on its kit, labels and rulers, and draws it at a moment each frame; the Orrery
 * moves that moment along its timeline, Deep Field holds it at today.
 */
import { Group, Object3D, Vector3, type Intersection, type Ray } from "three";

import { MOON_IDS, NAMED, PLANET_IDS, type BodyId } from "@horizon/toolkit/bodies";
import type { AnchoredRulers, LabelBody, PlaceLabel } from "@horizon/toolkit/scene";

import type { SwarmCounts } from "../../quality";
import { sunExists } from "../model/moment";
import type { SolarSelection } from "../model/selection";
import { createFocusRing } from "./focus-ring";
import { createGlobes } from "./geometry";
import type { ShownFor, SolarFrame, SolarKit } from "./kit";
import { createMoonsLayer } from "./moons-layer";
import { createPlanetsLayer } from "./planets-layer";
import { createPopulationsLayer } from "./populations-layer";
import { createSunLayer } from "./sun-layer";

type Point = readonly [number, number, number];

/** Past this camera distance (au), about 20 ly, the Oort cloud has faded and nothing shows. */
const REACH = 1_300_000;

const BODY_KEYS = ["sun", ...PLANET_IDS, ...NAMED.map((b) => b.id)];
/** Labels the scene places, hidden together before the Sun exists. */
export const SOLAR_LABEL_KEYS = [...BODY_KEYS, "snowLine", ...MOON_IDS];
/** Ruler anchors the scene writes: the Sun first (home), then the planets and named bodies. */
export const SOLAR_RULER_KEYS = BODY_KEYS;

const LABEL_PICKS = new Map<string, SolarSelection>([
  ["sun", { kind: "sun" }],
  ...PLANET_IDS.map((id): [string, SolarSelection] => [id, { kind: "planet", id }]),
  ...NAMED.map(({ id }): [string, SolarSelection] => [id, { kind: "named", id }]),
  ...MOON_IDS.map((id): [string, SolarSelection] => [id, { kind: "moon", id }]),
]);
/** What a tapped name opens; the snow line opens nothing. */
export const solarLabelPick = (key: string) => LABEL_PICKS.get(key);

const centre = new Vector3();
const size = new Vector3();
const candidates: { hit: Intersection; off: number; near: number }[] = [];

/**
 * Which body a tap meant: of the bodies under it (each pickable's `userData.globe`), the one whose
 * centre is nearest the tap as seen, unless a drawn globe the tap is on hides it. A moon behind
 * its planet's generous touch target, or seen through the asteroid belt's, is still the moon; a
 * belt or swarm counts only when no body is under the tap.
 */
export function chooseSolarHit(hits: Intersection[], ray: Ray): Intersection | undefined {
  candidates.length = 0;
  /** The nearest globe surface the tap is on: what lies behind it is hidden. */
  let wall = Infinity;
  for (const hit of hits) {
    const globe: unknown = hit.object.userData.globe;
    if (!(globe instanceof Object3D)) continue;
    globe.getWorldPosition(centre);
    const miss = ray.distanceToPoint(centre);
    const depth = centre.sub(ray.origin).dot(ray.direction);
    if (depth <= 0) continue;
    size.setFromMatrixScale(globe.matrixWorld);
    const radius = Math.max(size.x, size.y, size.z);
    if (miss <= radius) wall = Math.min(wall, depth - radius);
    candidates.push({ hit, off: miss / depth, near: depth - radius });
  }
  let best: Intersection | undefined;
  let bestOff = Infinity;
  for (const { hit, off, near } of candidates)
    if (near <= wall && off < bestOff) {
      best = hit;
      bestOff = off;
    }
  return best ?? hits[0];
}

/** Where rulers start for a selection: its body, a sample's or moon's position (`at`), or the Sun. */
export function rulerOrigin(sel: SolarSelection | null, at: Point | null): string | Point | null {
  if (sel?.kind === "planet" || sel?.kind === "named") return sel.id;
  return sel?.kind === "tracer" || sel?.kind === "moon" ? at : null;
}

export function createSolarSystem(
  kit: SolarKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    hideAll: (keys: readonly string[]) => void;
    setBodies: (bodies: readonly LabelBody[]) => void;
    rulers: AnchoredRulers;
    /** A body's own label, orbit and marker fade as its close-up fills the view. */
    shownFor?: ShownFor;
    /** The body in close-up, which stays drawn whatever the switches say. */
    closeId?: () => BodyId | null;
    /** Small bodies in each swarm, from the host's quality (`spaceQuality`). */
    swarms: SwarmCounts;
  },
) {
  const { place, rulers } = deps;
  const shownFor = deps.shownFor ?? (() => 1);
  const root = new Group();
  parent.add(root);
  const globes = createGlobes(kit);
  const sun = createSunLayer(kit, root, globes, place, shownFor);
  const closeId = deps.closeId ?? (() => null);
  const moons = createMoonsLayer(kit, root, globes, place, { closeId, shownFor });
  const planets = createPlanetsLayer(kit, root, {
    globes,
    place,
    rulers,
    hosts: moons.hosts,
    shownFor,
    closeId,
  });
  deps.setBodies([
    { key: "sun", mesh: sun.sun },
    ...planets.planets.map(({ id, body }) => ({ key: id, mesh: body })),
    ...planets.named.map(({ body, mesh }) => ({ key: body.id, mesh })),
    ...moons.labelBodies,
  ]);
  const populations = createPopulationsLayer(kit, root, deps.swarms);
  /* The reticle sits on a moon where its (maybe magnified) system draws it. */
  const focus = createFocusRing(kit, root, (sel: SolarSelection) =>
    sel.kind === "moon" ? moons.drawnAt(sel.id) : undefined,
  );

  return {
    /** Everything the scene draws; hosts may add to it (a tour's sketch, the Sun's activity). */
    root,
    sun: sun.sun,
    planets,
    moons,
    pickables: [sun.sun, ...planets.pickables, ...moons.pickables, ...populations.pickables],
    /** Redraws the swarms at a new quality's counts. */
    setSwarms: (counts: SwarmCounts) => populations.setCounts(counts),
    /**
     * Draws a frame. Returns where the selection is, for rulers and close-ups, or null;
     * `focusHidden` keeps the reticle off (a close-up fills the view).
     */
    update(frame: SolarFrame, focusHidden = false): Point | null {
      const on = sunExists(frame.yearsAgo) && frame.dist < REACH;
      root.visible = on;
      if (!on) {
        deps.hideAll(SOLAR_LABEL_KEYS);
        return null;
      }
      sun.update(frame);
      planets.update(frame);
      moons.update(frame);
      populations.update(frame);
      return focus.update(frame, focusHidden);
    },
  };
}
