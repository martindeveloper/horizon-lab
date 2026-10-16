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
import { AU_KM } from "@horizon/toolkit/science";

import { createSwarm, kuiperBelt, mainBelt, oortCloud, trojans } from "../graphics/swarms";
import { orbitInView, planetElements } from "../model/elements";
import { MODEL_START, SUN_BIRTH } from "../model/parameters";
import { TRACERS, binOf, tracerElements, tracerVisible, type Bin } from "../model/tracers";
import type { Selection } from "../store";
import { orbitOf } from "./geometry";
import { GOLD, type Frame, type SceneKit } from "./kit";

/** Population tints for the planetesimal lumps: icy grey in the disk, reddened in the belt, pale far out. */
const BIN_COLOR: Record<Bin, Color> = {
  disk: new Color("#a8a39b"),
  kuiper: new Color("#c09a82"),
  scattered: new Color("#a9b6c0"),
  oort: new Color("#d6dee4"),
  ejected: new Color("#c4705a"),
};
const BIN_CODE: Record<Bin, number> = { disk: 1, kuiper: 2, scattered: 3, oort: 4, ejected: 5 };

export function createPopulationsLayer(
  { scope, looks, tight, dpr, pxWorld }: SceneKit,
  parent: Object3D,
) {
  const rock = scope.own(new SphereGeometry(1, 12, 9));
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

  const focusOrbit = orbitOf(scope, GOLD, 0.95);
  parent.add(focusOrbit.line);

  const belt = scope.own(createSwarm(mainBelt(tight ? 1400 : 2600), 2.6, 1, false, dpr));
  const trojanSwarm = scope.own(createSwarm(trojans(tight ? 360 : 640), 2.7, 1, false, dpr));
  const kuiper = scope.own(createSwarm(kuiperBelt(tight ? 1600 : 3000), 2.2, 0.9, true, dpr));
  const oort = scope.own(createSwarm(oortCloud(tight ? 2000 : 3800), 1.9, 0.85, true, dpr));
  const beltHit = new Mesh(scope.own(new TorusGeometry(2.7, 0.42, 6, 28)), looks.ghost);
  beltHit.rotation.x = Math.PI / 2;
  beltHit.userData.pick = { kind: "population", id: "asteroids" } satisfies Selection;
  const kuiperHit = new Mesh(scope.own(new RingGeometry(38, 50, 48)), looks.ghost);
  kuiperHit.rotation.x = Math.PI / 2;
  kuiperHit.userData.pick = { kind: "population", id: "kuiper" } satisfies Selection;
  parent.add(belt.points, trojanSwarm.points, kuiper.points, oort.points, beltHit, kuiperHit);

  const diskRing = new Mesh(scope.own(new RingGeometry(16, 34, 64)), looks.disk);
  diskRing.rotation.x = Math.PI / 2;
  const shellInner = new Mesh(scope.own(new SphereGeometry(5_000, 40, 24)), looks.shellInner);
  const shellOuter = new Mesh(scope.own(new SphereGeometry(100_000, 40, 24)), looks.shellOuter);
  parent.add(diskRing, shellInner, shellOuter);

  const tmp: [number, number, number] = [0, 0, 0];

  /** Instance matrices and tints, rewritten only when the inputs that move them change. */
  const updateTracers = ({ show, yearsAgo, mig, driftYears, dist }: Frame, on: boolean) => {
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
    const stamp = `${yearsAgo}|${show.drift ? Math.round(driftYears * 200) : 0}|${Math.round(dist * 20)}|${mask}`;
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
    const cap = pxWorld(dist, 3.1);
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
      dummy.scale.setScalar(show.trueSize ? 30 / AU_KM : cap);
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
    update(f: Frame) {
      const { show, sel, yearsAgo, mig, driftYears, dist, now } = f;
      const planetesimals = SUN_BIRTH - yearsAgo > 1e6;
      updateTracers(f, planetesimals);

      let focus: Elements | null = null;
      if (sel?.kind === "tracer") {
        const tr = TRACERS[sel.index];
        if (tr) focus = tracerElements(tr, mig, 0);
      }
      focusOrbit.line.visible = !!focus && orbitInView(focus, true, dist, true);
      if (focus && focusOrbit.line.visible) focusOrbit.update(focus, show.elliptical);

      const jupiterEl = planetElements("jupiter", mig, driftYears, now);
      const jupiterLon = ((jupiterEl.node + jupiterEl.omega + jupiterEl.M) * Math.PI) / 180;
      beltHit.visible = dist < 28 && yearsAgo <= MODEL_START;
      belt.points.visible = dist < 160 && planetesimals;
      if (belt.points.visible) belt.set(mig, driftYears, pxWorld(dist, 40));
      trojanSwarm.points.visible = dist < 160 && planetesimals && mig > 0.5;
      if (trojanSwarm.points.visible)
        trojanSwarm.set(mig, driftYears, pxWorld(dist, 40), jupiterLon);
      kuiper.points.visible = show.kuiper && dist > 14 && dist < 1_600 && planetesimals;
      if (kuiper.points.visible) kuiper.set(mig, driftYears, pxWorld(dist, 30));
      kuiperHit.visible = kuiper.points.visible && dist < 400;
      oort.points.visible = show.oort && dist > 600 && dist < 900_000 && planetesimals;
      if (oort.points.visible) oort.set(mig, driftYears, pxWorld(dist, 40));
      diskRing.visible = show.disk && mig < 0.98 && dist < 400;
      looks.disk.opacity = (1 - mig) * 0.85;
      const oortOn = show.oort && dist > 4_000 && dist < 700_000;
      shellInner.visible = oortOn;
      shellOuter.visible = oortOn;
    },
  };
}
