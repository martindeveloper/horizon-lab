/** Small-body populations: the planetesimal sample, the GPU belts, the disk and the Oort shells. */
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";

import { keplerPosition, type Elements } from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import { fade, SOLAR_GOLD } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import type { SwarmCounts } from "../../quality";
import { createSwarm, kuiperBelt, mainBelt, oortCloud, trojans } from "../graphics/swarms";
import { planetElements } from "../model/elements";
import { MODEL_START, OORT_SHELLS_AU, SUN_BIRTH } from "../model/parameters";
import type { SolarSelection } from "../model/selection";
import { TRACERS, binOf, tracerElements, tracerVisible, type Bin } from "../model/tracers";
import { orbitOf } from "./geometry";
import { type SolarFrame, type SolarKit } from "./kit";

/** Population tints for the planetesimal lumps: icy grey in the disk, reddened in the belt, pale far out. */
const BIN_COLOR: Record<Bin, Color> = {
  disk: new Color("#a8a39b"),
  kuiper: new Color("#c09a82"),
  scattered: new Color("#a9b6c0"),
  oort: new Color("#d6dee4"),
  ejected: new Color("#c4705a"),
};
const BIN_CODE: Record<Bin, number> = { disk: 1, kuiper: 2, scattered: 3, oort: 4, ejected: 5 };

/** Where each population reads (camera distance, au): soft bands instead of cut-offs. */
const BELT = fade(0, 0, 110, 230);
const KUIPER = fade(10, 18, 1_100, 2_300);
const OORT = fade(420, 850, 600_000, 1_300_000);
const DISK = fade(0, 0, 280, 560);
const SHELLS = fade(2_800, 5_600, 500_000, 1_000_000);

export function createPopulationsLayer(
  { scope, looks, tight, dpr, pxWorld, lod }: SolarKit,
  parent: Object3D,
  counts: SwarmCounts,
) {
  const rock = scope.own(new SphereGeometry(1, tight ? 16 : 24, tight ? 12 : 16));
  const seeds = new Float32Array(TRACERS.length);
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = (i * 0.618034) % 1;
  rock.setAttribute("seed", new InstancedBufferAttribute(seeds, 1));
  const tracers = new InstancedMesh(rock, looks.tracers, TRACERS.length);
  tracers.frustumCulled = false;
  tracers.userData.pick = { kind: "tracer" };
  for (let i = 0; i < TRACERS.length; i += 1) tracers.setColorAt(i, BIN_COLOR.kuiper);
  parent.add(tracers);
  const tracerCodes = new Uint8Array(TRACERS.length);
  let tracerStamp = "";
  const dummy = new Object3D();

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

  const diskRing = new Mesh(scope.own(new RingGeometry(16, 34, 64)), looks.disk);
  diskRing.rotation.x = Math.PI / 2;
  diskRing.renderOrder = -1;
  const shellInner = new Mesh(
    scope.own(new SphereGeometry(OORT_SHELLS_AU[0], 40, 24)),
    looks.shellInner,
  );
  const shellOuter = new Mesh(
    scope.own(new SphereGeometry(OORT_SHELLS_AU[1], 40, 24)),
    looks.shellOuter,
  );
  parent.add(diskRing, shellInner, shellOuter);
  const shellOpacity = [
    Number(looks.shellInner.uniforms.opacity!.value),
    Number(looks.shellOuter.uniforms.opacity!.value),
  ];
  /* Display switches fade their layers in and out. */
  const kuiperOn = lod.fader();
  const oortOn = lod.fader();
  const diskOn = lod.fader();
  const age = lod.fader();

  const tmp: [number, number, number] = [0, 0, 0];

  /** Instance matrices and tints, rewritten only when the inputs that move them change. */
  const updateTracers = ({ show, yearsAgo, mig, driftYears, dist }: SolarFrame, on: boolean) => {
    tracers.visible = on;
    // Hidden buffers stay untouched. Invalidate so the first visible frame
    // always uses current positions, sizes and population filters.
    if (!on) {
      tracerStamp = "";
      return;
    }
    const mask =
      (show.disk ? 1 : 0) |
      (show.kuiper ? 2 : 0) |
      (show.scattered ? 4 : 0) |
      (show.oort ? 8 : 0) |
      (show.ejected ? 16 : 0) |
      (show.trueSize ? 32 : 0);
    /* Size is a uniform, so the zoom alone never rewrites the instances. */
    looks.tracers.uniforms.radius!.value = show.trueSize ? 30 / AU_KM : pxWorld(dist, 3.1);
    const stamp = `${yearsAgo}|${Math.round(driftYears * 200)}|${mask}`;
    if (stamp === tracerStamp) return;
    tracerStamp = stamp;
    const allow: Record<Bin, boolean> = {
      disk: show.disk,
      kuiper: show.kuiper,
      scattered: show.scattered,
      oort: show.oort,
      ejected: show.ejected,
    };
    let colorDirty = false;
    for (let i = 0; i < TRACERS.length; i += 1) {
      const tr = TRACERS[i]!;
      const bin = binOf(tr, mig);
      if (!(tracerVisible(tr, mig) && allow[bin])) {
        dummy.position.set(0, 0, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        tracers.setMatrixAt(i, dummy.matrix);
        continue;
      }
      keplerPosition(tracerElements(tr, mig, driftYears), tmp);
      dummy.position.set(tmp[0], tmp[1], tmp[2]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tracers.setMatrixAt(i, dummy.matrix);
      const code = BIN_CODE[bin];
      if (tracerCodes[i] !== code) {
        tracerCodes[i] = code;
        tracers.setColorAt(i, BIN_COLOR[bin]);
        colorDirty = true;
      }
    }
    tracers.instanceMatrix.needsUpdate = true;
    if (colorDirty && tracers.instanceColor) tracers.instanceColor.needsUpdate = true;
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
      updateTracers(f, planetesimals);

      let focus: Elements | null = null;
      if (sel?.kind === "tracer") {
        const tr = TRACERS[sel.index];
        if (tr) focus = tracerElements(tr, mig, 0);
      }
      /* A selected orbit always shows. */
      focusOrbit.line.visible = !!focus;
      if (focus) focusOrbit.update(focus, show.elliptical);

      const jupiterEl = planetElements("jupiter", mig, driftYears, now);
      const jupiterLon = ((jupiterEl.node + jupiterEl.omega + jupiterEl.M) * Math.PI) / 180;
      const formed = age.to(planetesimals);
      const belts = BELT(dist) * formed;
      beltHit.visible = belts > 0.5 && dist < 28 && yearsAgo <= MODEL_START;
      if (belt.fade(belts)) belt.set(mig, driftYears, pxWorld(dist, 40));
      if (trojanSwarm.fade(belts * smoothstep(0.45, 0.55, mig)))
        trojanSwarm.set(mig, driftYears, pxWorld(dist, 40), jupiterLon);
      const kuiperShown = KUIPER(dist) * kuiperOn.to(show.kuiper) * formed;
      if (kuiper.fade(kuiperShown)) kuiper.set(mig, driftYears, pxWorld(dist, 30));
      kuiperHit.visible = kuiperShown > 0.5 && dist < 400;
      const oortShown = oortOn.to(show.oort);
      if (oort.fade(OORT(dist) * oortShown * formed)) oort.set(mig, driftYears, pxWorld(dist, 40));
      const diskShown = DISK(dist) * diskOn.to(show.disk) * (1 - smoothstep(0.9, 0.98, mig));
      diskRing.visible = diskShown > 0.004;
      looks.disk.opacity = (1 - mig) * 0.85 * diskShown;
      const shells = SHELLS(dist) * oortShown;
      shellInner.visible = shellOuter.visible = shells > 0.004;
      looks.shellInner.uniforms.opacity!.value = shellOpacity[0]! * shells;
      looks.shellOuter.uniforms.opacity!.value = shellOpacity[1]! * shells;
    },
  };
}
