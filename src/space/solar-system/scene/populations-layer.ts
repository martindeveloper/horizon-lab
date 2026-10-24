/** Small-body populations: the planetesimal sample, the GPU belts, the disk and the Oort shells. */
import {
  Matrix4,
  Mesh,
  Ray,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Intersection,
  type Object3D,
} from "three";

import type { Elements, Vec3 } from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import {
  BELOW,
  fade,
  FAINTEST_OPACITY,
  SOLAR_GOLD,
  TAP_REACH_PX,
  type PlaceLabel,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import type { SwarmCounts } from "../../quality";
import { createSwarm, kuiperBelt, mainBelt, oortCloud, trojans } from "../graphics/swarms";
import { tracerGeometry } from "../graphics/tracers";
import { planetElements } from "../model/elements";
import { MODEL_START, OORT_SHELLS_AU, SUN_BIRTH } from "../model/parameters";
import { positionOf } from "../model/position";
import type { SolarSelection } from "../model/selection";
import { BINS, TRACERS, binOf, tracerElements, type Bin } from "../model/tracers";
import { orbitOf } from "./geometry";
import { type SolarFrame, type SolarKit } from "./kit";

const at: Vec3 = [0, 0, 0];
const centre = new Vector3();

/**
 * The samples a ray passes within `reach(depth)` of, at their depth along it, where the model
 * puts them at `moment`: those still in the system whose bin is shown, the one nearest the ray
 * as seen first, each with the ray's closest point to it. A tap reads the same model the GPU
 * draws from: its drift epoch holds the model's phases, so the two agree within a pixel.
 */
function tracersAlong(
  ray: Ray,
  moment: Pick<SolarFrame, "mig" | "driftYears" | "now">,
  shown: Readonly<Record<Bin, boolean>>,
  reach: (depth: number) => number,
): { index: number; point: Vector3 }[] {
  const hits: { index: number; point: Vector3; off: number }[] = [];
  for (let index = 0; index < TRACERS.length; index += 1) {
    if (!shown[binOf(TRACERS[index]!, moment.mig)]) continue;
    if (!positionOf({ kind: "tracer", index }, moment, moment.now, at)) continue;
    centre.set(at[0], at[1], at[2]);
    const point = ray.closestPointToPoint(centre, new Vector3());
    const depth = point.distanceTo(ray.origin);
    const miss = point.distanceTo(centre);
    if (depth <= 0 || miss > reach(depth)) continue;
    hits.push({ index, point, off: miss / depth });
  }
  return hits.sort((a, b) => a.off - b.off);
}

/** Where each population reads (camera distance, au): soft bands instead of cut-offs. */
const BELT = fade(0, 0, 110, 230);
const KUIPER = fade(10, 18, 1_100, 2_300);
const OORT = fade(420, 850, 600_000, 1_300_000);
const DISK = fade(0, 0, 280, 560);
const SHELLS = fade(2_800, 5_600, 500_000, 1_000_000);
/* The planetesimal sample is drawn at a fixed few pixels, which no single body earns from light-years
   away: it shrinks to nothing over the Oort shells' own band, well inside the scene's reach. */
const ROCKS = fade(0, 0, 500_000, 1_000_000);

export function createPopulationsLayer(
  { scope, looks, tight, dpr, pxWorld, lod }: SolarKit,
  parent: Object3D,
  counts: SwarmCounts,
  place: PlaceLabel,
) {
  const sample = tracerGeometry(tight ? 16 : 24, tight ? 12 : 16);
  const tracers = new Mesh(scope.own(sample.geometry), looks.tracers);
  tracers.frustumCulled = false;
  tracers.userData.pick = { kind: "tracer" };
  parent.add(tracers);
  const rocks = looks.tracers.uniforms;
  const binShown: number[] = rocks.binShown!.value;
  /** The moment and switches the sample was last drawn at, for taps. */
  let lastDrawn: SolarFrame | null = null;
  const toLocal = new Matrix4();
  const local = new Ray();
  /* A tap finds the sample where the GPU drew it, from the same model, within a fingertip as
     planets are or the drawn rock where that is larger (the shader's `radius` is in the
     layer's own units); of those, the one nearest the tap as seen. */
  tracers.raycast = (raycaster, intersects: Intersection[]) => {
    if (!lastDrawn) return;
    local.copy(raycaster.ray).applyMatrix4(toLocal.copy(tracers.matrixWorld).invert());
    const scale = tracers.matrixWorld.getMaxScaleOnAxis();
    const reach = (depth: number) =>
      Math.max(rocks.radius!.value, pxWorld(depth * scale, TAP_REACH_PX) / scale);
    const [best] = tracersAlong(local, lastDrawn, lastDrawn.show, reach);
    if (!best) return;
    const point = best.point.applyMatrix4(tracers.matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(point);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({ distance, point, object: tracers, instanceId: best.index });
  };

  const focusOrbit = orbitOf(scope, SOLAR_GOLD, 0.95);
  parent.add(focusOrbit.line);

  const belt = scope.own(createSwarm(mainBelt(counts.belt), 2.6, 1, false, dpr));
  const trojanSwarm = scope.own(createSwarm(trojans(counts.trojans), 2.7, 1, false, dpr));
  const kuiper = scope.own(createSwarm(kuiperBelt(counts.kuiper), 2.2, 0.9, true, dpr));
  const oort = scope.own(createSwarm(oortCloud(counts.oort), 1.9, 0.85, true, dpr));
  let drawn = counts;
  const beltHit = new Mesh(scope.own(new TorusGeometry(2.7, 0.42, 6, 28)), looks.ghost);
  beltHit.rotation.x = Math.PI / 2;
  beltHit.userData.pick = { kind: "population", id: "asteroids" } satisfies SolarSelection;
  const kuiperHit = new Mesh(scope.own(new RingGeometry(38, 50, 48)), looks.ghost);
  kuiperHit.rotation.x = Math.PI / 2;
  kuiperHit.userData.pick = { kind: "population", id: "kuiper" } satisfies SolarSelection;
  parent.add(belt.points, trojanSwarm.points, kuiper.points, oort.points, beltHit, kuiperHit);

  /* The disc's tint and the Oort cloud's shells are boundaries drawn as surfaces: annotation, which a
     drift's veil fades with the lines; the swarms beneath them stay. */
  const diskRing = new Mesh(scope.own(new RingGeometry(16, 34, 64)), looks.disk);
  diskRing.userData.annotation = true;
  diskRing.rotation.x = Math.PI / 2;
  diskRing.renderOrder = -1;
  const shellInner = new Mesh(
    scope.own(new SphereGeometry(OORT_SHELLS_AU[0], 40, 24)),
    looks.shellInner,
  );
  shellInner.userData.annotation = true;
  const shellOuter = new Mesh(
    scope.own(new SphereGeometry(OORT_SHELLS_AU[1], 40, 24)),
    looks.shellOuter,
  );
  shellOuter.userData.annotation = true;
  parent.add(diskRing, shellInner, shellOuter);
  const shellOpacity = [
    Number(looks.shellInner.uniforms.opacity!.value),
    Number(looks.shellOuter.uniforms.opacity!.value),
  ];
  /* Display switches fade their layers in and out. */
  const names = lod.fader();
  const kuiperOn = lod.fader();
  const oortOn = lod.fader();
  const diskOn = lod.fader();
  const age = lod.fader();
  /** The planetesimal disk is drawn from the first solids on. */
  const solids = lod.fader();

  const jupiterEl: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 };

  /**
   * The sample moves on the GPU: a frame writes only the moment, its switches and its size (and,
   * now and then, the phases at a new drift epoch).
   */
  const updateTracers = (f: SolarFrame, on: boolean, pixel: number) => {
    const { show, mig, driftYears, dist } = f;
    const presence = ROCKS(dist);
    /* The presence is the sample's size: shrunk under the faintest opacity, it draws nothing. */
    tracers.visible = on && presence > FAINTEST_OPACITY;
    lastDrawn = tracers.visible ? f : null;
    if (!tracers.visible) return;
    rocks.mig!.value = mig;
    rocks.drift!.value = sample.drift.since(mig, driftYears, pixel);
    rocks.radius!.value = show.trueSize ? 30 / AU_KM : pxWorld(dist, 3.1) * presence;
    for (let i = 0; i < BINS.length; i += 1) binShown[i] = show[BINS[i]!] ? 1 : 0;
  };

  return {
    pickables: [tracers, beltHit, kuiperHit],
    /** Refills the swarms whose count changed. */
    setCounts(next: SwarmCounts) {
      if (next.belt !== drawn.belt) belt.refill(mainBelt(next.belt));
      if (next.trojans !== drawn.trojans) trojanSwarm.refill(trojans(next.trojans));
      if (next.kuiper !== drawn.kuiper) kuiper.refill(kuiperBelt(next.kuiper));
      if (next.oort !== drawn.oort) oort.refill(oortCloud(next.oort));
      drawn = next;
    },
    update(f: SolarFrame) {
      const { show, sel, yearsAgo, mig, driftYears, dist, now } = f;
      const planetesimals = SUN_BIRTH - yearsAgo > 1e6;
      /* A pixel's world size at the aim: the drift epochs keep the GPU's float32 phases within a
         fraction of it of the model's. */
      const pixel = pxWorld(dist, 1);
      updateTracers(f, planetesimals, pixel);

      let focus: Elements | null = null;
      if (sel?.kind === "tracer") {
        const tr = TRACERS[sel.index];
        if (tr) focus = tracerElements(tr, mig, 0);
      }
      /* A selected orbit always shows. */
      focusOrbit.line.visible = !!focus;
      if (focus) focusOrbit.update(focus, show.elliptical);

      planetElements("jupiter", mig, driftYears, now, jupiterEl);
      const jupiterLon = ((jupiterEl.node + jupiterEl.omega + jupiterEl.M) * Math.PI) / 180;
      const formed = age.to(planetesimals);
      const belts = BELT(dist) * formed;
      beltHit.visible = belts > 0.5 && dist < 28 && yearsAgo <= MODEL_START;
      if (belt.fade(belts)) belt.set(mig, driftYears, pixel, pxWorld(dist, 40));
      if (trojanSwarm.fade(belts * smoothstep(0.45, 0.55, mig)))
        trojanSwarm.set(mig, driftYears, pixel, pxWorld(dist, 40), jupiterLon);
      const kuiperShown = KUIPER(dist) * kuiperOn.to(show.kuiper) * formed;
      if (kuiper.fade(kuiperShown)) kuiper.set(mig, driftYears, pixel, pxWorld(dist, 30));
      kuiperHit.visible = kuiperShown > 0.5 && dist < 400;
      const oortShown = oortOn.to(show.oort);
      if (oort.fade(OORT(dist) * oortShown * formed))
        oort.set(mig, driftYears, pixel, pxWorld(dist, 40));
      const diskShown =
        DISK(dist) *
        diskOn.to(show.disk) *
        solids.to(yearsAgo <= SUN_BIRTH) *
        (1 - smoothstep(0.9, 0.98, mig));
      diskRing.visible = diskShown > 0.004;
      looks.disk.opacity = (1 - mig) * 0.85 * diskShown;
      const shells = SHELLS(dist) * oortShown;
      shellInner.visible = shellOuter.visible = shells > 0.004;
      looks.shellInner.uniforms.opacity!.value = shellOpacity[0]! * shells;
      looks.shellOuter.uniforms.opacity!.value = shellOpacity[1]! * shells;
      /* Each shell is named at the near edge of its equator, below the point, as the snow line is:
         its pole would project above the frame at the views' tilts. */
      const labelled = names.to(show.names) * shells;
      place("oortInner", 0, 0, OORT_SHELLS_AU[0], labelled, BELOW);
      place("oortOuter", 0, 0, OORT_SHELLS_AU[1], labelled, BELOW);
    },
  };
}
