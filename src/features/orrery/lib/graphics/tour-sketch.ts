/**
 * Drawings the tour lays into the solar map once a step lands. Every curve is
 * the model's own Kepler motion: the arc each planet covers in one year,
 * Halley's equal-time sectors (Kepler's second law makes them equal in area)
 * and the one-way spin of the birth disk.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import {
  keplerPosition,
  namedById,
  periodYears,
  type Elements,
  type PlanetId,
} from "@horizon/toolkit/bodies";
import { smootherstep } from "@horizon/toolkit/math";
import { SOLAR_GOLD } from "@horizon/toolkit/scene";

import type { TourSketchId } from "../model/tour";

type Vec3 = [number, number, number];
type Shape = { points: Vec3[]; fill?: boolean; opacity: number; delay: number; duration: number };

const YEAR_PLANETS: readonly PlanetId[] = [
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];
const SUN: Vec3 = [0, 0, 0];

const at = (el: Elements, M: number): Vec3 => keplerPosition({ ...el, M }, [0, 0, 0]);

/** Points along an orbit from mean anomaly m0 to m1, in degrees. */
export function orbitArc(el: Elements, m0: number, m1: number, n = 64): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) pts.push(at(el, m0 + ((m1 - m0) * i) / n));
  return pts;
}

/** Degrees of mean anomaly a body covers in `years`. */
export const sweptDegrees = (el: Elements, years: number) => (360 * years) / periodYears(el.a);

/** Area of a Sun-centred fan through these arc points. */
export function fanArea(arc: Vec3[]) {
  let area = 0;
  for (let i = 1; i < arc.length; i++) {
    const a = arc[i - 1]!;
    const b = arc[i]!;
    const cx = a[1] * b[2] - a[2] * b[1];
    const cy = a[2] * b[0] - a[0] * b[2];
    const cz = a[0] * b[1] - a[1] * b[0];
    area += Math.hypot(cx, cy, cz) / 2;
  }
  return area;
}

/** Equal-time sectors: centred on perihelion, a quarter period on, and aphelion. */
export function equalTimeSectors(el: Elements, width = 36, n = 64) {
  return [0, 90, 180].map((centre) => orbitArc(el, centre - width / 2, centre + width / 2, n));
}

function shapesFor(id: TourSketchId, mig: number, driftYears: number, date: Date, elapsed: number) {
  const shapes: Shape[] = [];
  if (id === "year") {
    YEAR_PLANETS.forEach((planet, k) => {
      const el = planetElements(planet, mig, driftYears, date);
      const sweep = Math.min(360, sweptDegrees(el, 1));
      const arc = orbitArc(el, el.M, el.M + sweep);
      const delay = 0.2 + k * 0.35;
      // Earth's year is the whole loop; farther out, a narrowing wedge from the Sun.
      if (sweep >= 359) shapes.push({ points: arc, opacity: 0.9, delay, duration: 2.2 });
      else {
        shapes.push({ points: [SUN, ...arc, SUN], opacity: 0.85, delay, duration: 2.6 });
        shapes.push({
          points: [SUN, ...arc],
          fill: true,
          opacity: 0.1,
          delay: delay + 1,
          duration: 1.6,
        });
      }
    });
  }
  if (id === "areas") {
    const el = namedElements(namedById("halley"), mig, driftYears, date);
    equalTimeSectors(el).forEach((arc, k) => {
      const delay = 0.3 + k * 0.9;
      shapes.push({ points: [SUN, ...arc, SUN], opacity: 0.85, delay, duration: 1.8 });
      shapes.push({
        points: [SUN, ...arc],
        fill: true,
        opacity: 0.16,
        delay: delay + 0.6,
        duration: 1.4,
      });
    });
    // The empty focus, 2ae from the Sun along the major axis.
    const q = at(el, 0);
    const Q = at(el, 180);
    shapes.push({ points: [q, Q], opacity: 0.28, delay: 0, duration: 1.6 });
    const s = 2 * el.a * el.e;
    const r = Math.hypot(q[0], q[1], q[2]) || 1;
    const f: Vec3 = [(-q[0] / r) * s, (-q[1] / r) * s, (-q[2] / r) * s];
    const h = Math.hypot(Q[0], Q[1], Q[2]) * 0.025;
    shapes.push({
      points: [
        [f[0] - h, f[1], f[2]],
        [f[0] + h, f[1], f[2]],
      ],
      opacity: 0.9,
      delay: 3,
      duration: 0.3,
    });
    shapes.push({
      points: [
        [f[0], f[1], f[2] - h],
        [f[0], f[1], f[2] + h],
      ],
      opacity: 0.9,
      delay: 3,
      duration: 0.3,
    });
  }
  if (id === "sense") {
    // Prograde is a right-handed turn about +Y: (r cos θ, 0, −r sin θ) with θ rising.
    const flow = elapsed * 0.03;
    [5, 10, 17, 26].forEach((r, ring) => {
      for (let k = 0; k < 3; k++) {
        // Kepler: angular speed ∝ r^−3/2, so the inner rings lap the outer ones.
        const t0 = flow * (10 / r) ** 1.5 + ring * 0.7 + (k * Math.PI * 2) / 3;
        const t1 = t0 + 0.6;
        const arc: Vec3[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = t0 + ((t1 - t0) * i) / 24;
          arc.push([r * Math.cos(t), 0, -r * Math.sin(t)]);
        }
        const tip = arc[24]!;
        const w = r * 0.07;
        const wing = (side: number): Vec3 => {
          const back = t1 - 0.07 * side;
          const rr = r + w * side;
          return [rr * Math.cos(back - 0.07), 0, -rr * Math.sin(back - 0.07)];
        };
        const delay = 0.3 + ring * 0.3 + k * 0.1;
        shapes.push({ points: arc, opacity: 0.8, delay, duration: 1.6 });
        shapes.push({
          points: [wing(1), tip, wing(-1)],
          opacity: 0.8,
          delay: delay + 1.5,
          duration: 0.25,
        });
      }
    });
  }
  return shapes;
}

/** A pool of lines and fans, drawn over the orbits without depth so they never flicker. */
export function createTourSketch() {
  const group = new Group();
  group.renderOrder = 7;
  const lines: { line: Line; positions: Float32Array; material: LineBasicMaterial }[] = [];
  const fans: { mesh: Mesh; positions: Float32Array; material: MeshBasicMaterial }[] = [];
  const LINE_CAP = 80;
  const FAN_CAP = 64;

  const lineSlot = (i: number) => {
    if (!lines[i]) {
      const positions = new Float32Array(LINE_CAP * 3);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const material = new LineBasicMaterial({
        color: SOLAR_GOLD,
        transparent: true,
        depthTest: false,
      });
      const line = new Line(geometry, material);
      line.frustumCulled = false;
      line.renderOrder = 7;
      group.add(line);
      lines[i] = { line, positions, material };
    }
    return lines[i];
  };
  const fanSlot = (i: number) => {
    if (!fans[i]) {
      const positions = new Float32Array(FAN_CAP * 9);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const material = new MeshBasicMaterial({
        color: SOLAR_GOLD,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      });
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 6;
      group.add(mesh);
      fans[i] = { mesh, positions, material };
    }
    return fans[i];
  };

  return {
    group,
    /** Draw `id` `elapsed` seconds after its step landed, at `fade` opacity; null hides it. */
    update(
      id: TourSketchId | null,
      frame: { elapsed: number; fade: number; mig: number; driftYears: number; date: Date },
    ) {
      let nl = 0;
      let nf = 0;
      if (id && frame.fade > 0) {
        for (const shape of shapesFor(id, frame.mig, frame.driftYears, frame.date, frame.elapsed)) {
          const q = Math.min(1, Math.max(0, (frame.elapsed - shape.delay) / shape.duration));
          if (q <= 0) continue;
          const reveal = smootherstep(q);
          if (shape.fill) {
            const slot = fanSlot(nf++);
            const arc = shape.points.slice(1);
            const tris = Math.min(FAN_CAP, arc.length - 1);
            for (let i = 0; i < tris; i++) {
              const a = arc[i]!;
              const b = arc[i + 1]!;
              slot.positions.set([0, 0, 0, a[0], a[1], a[2], b[0], b[1], b[2]], i * 9);
            }
            const geometry = slot.mesh.geometry;
            geometry.getAttribute("position").needsUpdate = true;
            geometry.setDrawRange(0, tris * 3);
            slot.material.opacity = shape.opacity * reveal * frame.fade;
            slot.mesh.visible = true;
          } else {
            const slot = lineSlot(nl++);
            const count = Math.min(LINE_CAP, shape.points.length);
            for (let i = 0; i < count; i++) slot.positions.set(shape.points[i]!, i * 3);
            const geometry = slot.line.geometry;
            geometry.getAttribute("position").needsUpdate = true;
            geometry.setDrawRange(0, Math.max(2, Math.ceil(count * reveal)));
            slot.material.opacity = shape.opacity * Math.min(1, reveal * 1.4) * frame.fade;
            slot.line.visible = true;
          }
        }
      }
      for (let i = nl; i < lines.length; i++) lines[i]!.line.visible = false;
      for (let i = nf; i < fans.length; i++) fans[i]!.mesh.visible = false;
    },
    dispose() {
      for (const { line, material } of lines) {
        line.geometry.dispose();
        material.dispose();
      }
      for (const { mesh, material } of fans) {
        mesh.geometry.dispose();
        material.dispose();
      }
    },
  };
}
