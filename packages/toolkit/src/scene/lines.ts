/**
 * Reusable line buffers: a polyline written in place, an orbit the GPU builds from its
 * ellipse, and a dashed ruler between two points.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  Vector2,
  Vector3,
  Vector4,
  type Object3D,
} from "three";

import type { OrbitShape } from "../bodies";
import { smootherstep } from "../math";
import type { DisposalScope } from "../rendering/disposal";
import ORBIT_GLSL from "../shaders/orbit.glsl";

export type LineSlot = ReturnType<typeof lineOf>;

/** A polyline of `segments` segments; write `positions` and flag the attribute. */
export function lineOf(color: number, opacity: number, segments = 96) {
  const positions = new Float32Array((segments + 1) * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const line = new Line(geometry, material);
  line.frustumCulled = false;
  return { line, positions, geometry, material };
}

/** A line whose geometry and material the scope disposes. */
export function ownedLine(scope: DisposalScope, color: number, opacity: number, segments = 96) {
  const slot = lineOf(color, opacity, segments);
  scope.own(slot.geometry);
  scope.own(slot.material);
  return slot;
}

/** The uniforms `<horizon/orbit>` reads: one orbit's ellipse and plane. */
export type OrbitUniforms = {
  orbitConic: { value: Vector4 };
  orbitP: { value: Vector3 };
  orbitQ: { value: Vector3 };
  orbitStart: { value: Vector2 };
};

export const orbitUniforms = (): OrbitUniforms => ({
  orbitConic: { value: new Vector4(0, 0, 0, 1) },
  orbitP: { value: new Vector3(1, 0, 0) },
  orbitQ: { value: new Vector3(0, 0, -1) },
  orbitStart: { value: new Vector2(1, 0) },
});

/**
 * Writes an orbit's shape into its uniforms, in the line's units (its scale and place are the
 * line's own). Only uniforms change: the vertices are rebuilt by the GPU. The line starts at
 * the body, so it passes through the body however coarse its segments are.
 */
export function writeOrbitUniforms(uniforms: OrbitUniforms, { a, e, p, q, E }: OrbitShape) {
  /* The sampling anomaly u and its spacing k, tan(u/2) = k tan(E/2), k⁴ = (1 + e) / (1 − e):
     see orbit.glsl. */
  const spacing = Math.sqrt(Math.sqrt((1 + e) / (1 - e)));
  const start = 2 * Math.atan2(spacing * Math.sin(E / 2), Math.cos(E / 2));
  uniforms.orbitConic.value.set(a, a * e, a * Math.sqrt(1 - e * e), spacing);
  uniforms.orbitP.value.fromArray(p);
  uniforms.orbitQ.value.fromArray(q);
  uniforms.orbitStart.value.set(Math.cos(start), Math.sin(start));
}

/**
 * A closed orbit's sampling anomalies, from the body (0) round to the body again (2π), as
 * (cos, sin) pairs. Far from the body they are as fine as `segments` even steps would be; near
 * it they tighten, so the line does not kink where a camera parked by the body looks along it.
 *
 * Seen from the body, a chord of a circle of radius R spanning Δ at angle φ from the body bows
 * by R Δ² / 8 at a distance 2R sin(φ/2): it strays by Δ² / (16 sin(φ/2)). Holding that to the
 * far side's (Δ = h = 2π / segments at φ = π) asks for Δ ≤ h √sin(φ/2). Even steps in √φ on
 * each half, mirrored about the far side, meet it everywhere (y / √sin y² is largest at the far
 * side, y² = π/2) and take exactly h there: `segments` steps a half, φ = π (s / segments)².
 */
export function orbitSamples(segments = 96) {
  const samples = new Float32Array((2 * segments + 1) * 2);
  for (let s = 0; s <= 2 * segments; s += 1) {
    const fromBody = Math.min(s, 2 * segments - s) / segments;
    const half = Math.PI * fromBody * fromBody;
    const u = s <= segments ? half : 2 * Math.PI - half;
    samples[s * 2] = Math.cos(u);
    samples[s * 2 + 1] = Math.sin(u);
  }
  return samples;
}

/** The orbit geometries in use, by segment count, with how many holders each has. */
const orbitGeometries = new Map<number, { geometry: BufferGeometry; holders: number }>();

/**
 * A closed orbit's static vertices (`orbitSamples`): each carries its sampling anomaly as
 * (cos, sin) in `orbitSample`, the attribute `<horizon/orbit>` reads. One geometry serves every
 * orbit line of that resolution: `scope` holds it, and it is disposed once the last scope
 * holding it is, never while another line still draws it.
 */
export function orbitGeometry(scope: DisposalScope, segments = 96) {
  let shared = orbitGeometries.get(segments);
  if (!shared) {
    const samples = orbitSamples(segments);
    const geometry = new BufferGeometry();
    geometry.setAttribute("orbitSample", new BufferAttribute(samples, 2));
    /* No `position`: the draw range alone says how many vertices there are. */
    geometry.setDrawRange(0, samples.length / 2);
    shared = { geometry, holders: 0 };
    orbitGeometries.set(segments, shared);
  }
  const held = shared;
  held.holders += 1;
  scope.defer(() => {
    held.holders -= 1;
    if (held.holders > 0) return;
    orbitGeometries.delete(segments);
    held.geometry.dispose();
  });
  return held.geometry;
}

export type OrbitLine = ReturnType<typeof ownedOrbitLine>;

/**
 * An orbit line drawn as `ownedLine` draws (the same basic line material: colour, opacity,
 * fog, depth), its vertices built by the GPU from the ellipse (`<horizon/orbit>`): `set` a new
 * shape each frame for the price of three uniforms, never a buffer upload.
 */
export function ownedOrbitLine(
  scope: DisposalScope,
  color: number,
  opacity: number,
  segments = 96,
) {
  const uniforms = orbitUniforms();
  const material = scope.own(
    new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${ORBIT_GLSL}\n${shader.vertexShader.replace(
      "#include <begin_vertex>",
      "vec3 transformed = orbitPoint();",
    )}`;
  };
  const line = new Line(orbitGeometry(scope, segments), material);
  line.frustumCulled = false;
  return {
    line,
    material,
    set: (shape: OrbitShape) => writeOrbitUniforms(uniforms, shape),
  };
}

/** A dashed ruler between two points, drawn over everything; dash lengths are set per frame. */
export function rulerOf(scope: DisposalScope, color: number) {
  const positions = new Float32Array(6);
  const geometry = scope.own(new BufferGeometry());
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = scope.own(
    new LineDashedMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      dashSize: 1,
      gapSize: 1,
    }),
  );
  const line = new Line(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 6;
  line.visible = false;
  return { line, positions, geometry, material };
}

/** Seconds the veil takes to fall or lift. */
const VEIL_SECONDS = 0.8;

export type LineVeil = ReturnType<typeof createLineVeil>;

/**
 * A veil over a scene's line art (orbits, grids, rings, rulers, trails): while it is down, every
 * `Line` fades out together and the picture is left to the bodies and the sky. Lines that are
 * content, not annotation (a web's filaments), opt out with `userData.content = true`; any other
 * object that is annotation (a boundary drawn as a surface, such as a translucent shell) opts in
 * with `userData.annotation = true`. Call `step` each frame, then `cover` just before rendering
 * and `uncover` right after, so the layers' own visibility and opacity are never disturbed
 * between frames.
 */
export function createLineVeil(seconds = VEIL_SECONDS) {
  /** 1 with the lines fully shown, 0 with them gone. */
  let presence = 1;
  let target = 1;
  const hidden: Object3D[] = [];
  const dimmed = new Map<Material, { opacity: number; transparent: boolean }>();

  return {
    get presence() {
      return presence;
    },
    /** The veil is on its way down or up. */
    get busy() {
      return presence !== target;
    },
    /** Eases toward showing the lines or not. */
    step(dt: number, shown: boolean) {
      target = shown ? 1 : 0;
      if (presence === target) return;
      const rate = dt / Math.max(0.05, seconds);
      presence =
        target > presence ? Math.min(target, presence + rate) : Math.max(target, presence - rate);
    },
    /** Dims or hides every line, and every object marked annotation, under `root` for this render. */
    cover(root: Object3D) {
      if (presence >= 1) return;
      const k = smootherstep(presence);
      root.traverse((object) => {
        const annotation =
          object.userData.annotation === true ||
          (object instanceof Line && object.userData.content !== true);
        if (!annotation || !object.visible) return;
        if (k <= 0.002) {
          object.visible = false;
          hidden.push(object);
          return;
        }
        const material: unknown = "material" in object ? object.material : null;
        if (!(material instanceof Material) || dimmed.has(material)) return;
        dimmed.set(material, { opacity: material.opacity, transparent: material.transparent });
        material.transparent = true;
        material.opacity *= k;
      });
    },
    /** Gives every line back what `cover` took. */
    uncover() {
      for (const object of hidden) object.visible = true;
      hidden.length = 0;
      for (const [material, was] of dimmed) {
        material.opacity = was.opacity;
        material.transparent = was.transparent;
      }
      dimmed.clear();
    },
  };
}
