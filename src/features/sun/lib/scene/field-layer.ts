/**
 * Field lines and loops as instanced ribbons: one instance per segment, each knowing its
 * neighbours so the vertex shader mitres the joins (`ribbon.vert.glsl`); width in CSS pixels,
 * soft edges, added to the frame and depth-tested against the globe. The eruption's lines are
 * extruded into an arcade along the region's neutral line, and its X-point marked. The buffers
 * are rebuilt only when the frame's line arrays change.
 */
import {
  AdditiveBlending,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Sphere,
  Vector3,
  type Object3D,
} from "three";

import { ARCADE_SLICES } from "@/space/sun/model/parameters";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import type { createLightTables } from "../graphics/light-tables";
import RIBBON_FRAG from "../graphics/ribbon.frag.glsl";
import RIBBON_VERT from "../graphics/ribbon.vert.glsl";
import {
  ARCADE_FALLOFF,
  ARCADE_STRIDE,
  ARCADE_TRIM,
  ERUPTION_BACKGROUND,
  ERUPTION_MAX_LINES,
  FLARE_K,
  RIBBON_FLOOR,
  RIBBON_MAX_POINTS,
  RIBBON_STRENGTH_TOP,
  TUBE_WIDTH,
  XPOINT_ARM,
} from "../parameters";

/** A line's strength as drawn: a floor every line keeps, then a log scale up to the strongest. */
const shown = (strength: number) =>
  RIBBON_FLOOR +
  (1 - RIBBON_FLOOR) *
    Math.min(1, Math.log1p(Math.max(strength, 0)) / Math.log1p(RIBBON_STRENGTH_TOP));
import type { SunQuality } from "../quality";
import { bipoleAxis, directionOf, type Polyline, type SunFrame } from "./frame";
import type { SunLooks } from "./looks";

/** The farthest any ribbon reaches, radii: the atmosphere's bound covers every open line drawn. */
const REACH = 6;

type Buffers = {
  prev: Float32Array;
  start: Float32Array;
  end: Float32Array;
  next: Float32Array;
  line: Float32Array;
  along: Float32Array;
  fade: Float32Array;
  tube: Float32Array;
  capacity: number;
};

function buffers(capacity: number): Buffers {
  return {
    prev: new Float32Array(capacity * 3),
    start: new Float32Array(capacity * 3),
    end: new Float32Array(capacity * 3),
    next: new Float32Array(capacity * 3),
    line: new Float32Array(capacity * 4),
    along: new Float32Array(capacity * 2),
    fade: new Float32Array(capacity),
    tube: new Float32Array(capacity),
    capacity,
  };
}

export function createFieldLayer(
  scope: DisposalScope,
  scene: Object3D,
  looks: SunLooks,
  tables: ReturnType<typeof createLightTables>,
) {
  const uniforms = {
    ...looks.uniforms,
    uRamp: { value: tables.ramp },
    uResponse: { value: tables.response },
    uHalfWidth: { value: 1e-3 },
    uPresence: { value: 1 },
  };
  const material = scope.own(
    new ShaderMaterial({
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      uniforms,
      blending: AdditiveBlending,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }),
  );
  let geometry: InstancedBufferGeometry | null = null;
  let mesh: Mesh | null = null;
  let data: Buffers | null = null;
  let maxLines = 0;
  let maxPoints = 0;
  scope.defer(() => {
    geometry?.dispose();
    mesh?.removeFromParent();
  });

  /** Buffers for a quality's counts, built afresh when they grow. */
  function allocate(quality: SunQuality) {
    maxLines = quality.fieldLines;
    maxPoints = Math.min(quality.ribbonSegments, RIBBON_MAX_POINTS);
    const capacity = (maxLines + ERUPTION_MAX_LINES) * (maxPoints - 1) + 2;
    if (data && data.capacity >= capacity) return;
    data = buffers(capacity);
    geometry?.dispose();
    mesh?.removeFromParent();
    geometry = new InstancedBufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3),
    );
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const instanced = (array: Float32Array, size: number) => {
      const attribute = new InstancedBufferAttribute(array, size);
      attribute.setUsage(DynamicDrawUsage);
      return attribute;
    };
    geometry.setAttribute("aPrev", instanced(data.prev, 3));
    geometry.setAttribute("aStart", instanced(data.start, 3));
    geometry.setAttribute("aEnd", instanced(data.end, 3));
    geometry.setAttribute("aNext", instanced(data.next, 3));
    geometry.setAttribute("aLine", instanced(data.line, 4));
    geometry.setAttribute("aAlong", instanced(data.along, 2));
    geometry.setAttribute("aFade", instanced(data.fade, 1));
    geometry.setAttribute("aTube", instanced(data.tube, 1));
    geometry.boundingSphere = new Sphere(new Vector3(), REACH);
    geometry.instanceCount = 0;
    mesh = new Mesh(geometry, material);
    mesh.name = "Field lines";
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    scene.add(mesh);
    stale = true;
  }

  let stale = true;
  let lastLines: Polyline[] | null = null;
  let lastEruption: Polyline[] | null = null;
  let lastXPoint = "";
  let count = 0;
  const offset: [number, number, number] = [0, 0, 0];

  /** One polyline's segments, resampled to at most `maxPoints` points, shifted by `offset`. */
  function writeLine(line: Polyline, fade: number, tube = 1) {
    if (!data || line.count < 2) return;
    const n = Math.min(line.count, maxPoints);
    const at = (i: number) => Math.round((i * (line.count - 1)) / (n - 1)) * 3;
    const put = (array: Float32Array, index: number, point: number) => {
      array[index * 3] = line.points[point]! + offset[0];
      array[index * 3 + 1] = line.points[point + 1]! + offset[1];
      array[index * 3 + 2] = line.points[point + 2]! + offset[2];
    };
    for (let i = 0; i < n - 1; i++) {
      if (count >= data.capacity) return;
      put(data.prev, count, at(Math.max(i - 1, 0)));
      put(data.start, count, at(i));
      put(data.end, count, at(i + 1));
      put(data.next, count, at(Math.min(i + 2, n - 1)));
      data.line.set(
        [line.polarity, line.open ? 1 : 0, shown(line.strength), line.kelvin],
        count * 4,
      );
      data.along.set([i / (n - 1), (i + 1) / (n - 1)], count * 2);
      data.fade[count] = fade;
      data.tube[count] = tube;
      count++;
    }
  }

  /** The X-point's cross: two short arms at the current sheet's foot. */
  function writeCross(centre: Vector3, axis: Vector3, strength: number) {
    const radial = centre.clone().normalize();
    const arm = (a: Vector3, b: Vector3) => {
      const points = new Float32Array([...a.toArray(), ...centre.toArray(), ...b.toArray()]);
      writeLine(
        { points, count: 3, polarity: 1, open: false, strength, kelvin: FLARE_K },
        1,
        TUBE_WIDTH,
      );
    };
    const across = axis.clone().multiplyScalar(XPOINT_ARM);
    const up = radial.multiplyScalar(XPOINT_ARM);
    arm(centre.clone().sub(across).sub(up), centre.clone().add(across).add(up));
    arm(centre.clone().sub(across).add(up), centre.clone().add(across).sub(up));
  }

  const centre = new Vector3();
  const axis = new Vector3();
  const dir: [number, number, number] = [0, 0, 0];

  return {
    setQuality(quality: SunQuality) {
      allocate(quality);
    },
    update(frame: SunFrame, shown: boolean) {
      if (!geometry || !data || !mesh) return;
      mesh.visible = shown && count > 0;
      const eruption = frame.eruption;
      const region = eruption ? frame.regions.find((r) => r.id === eruption.regionId) : undefined;
      const xPoint =
        eruption && region && eruption.reconnection > 0
          ? `${eruption.sheetBottom.toFixed(4)}:${eruption.reconnection.toFixed(3)}`
          : "";
      if (
        !stale &&
        frame.fieldLines === lastLines &&
        (eruption?.lines ?? null) === lastEruption &&
        xPoint === lastXPoint
      )
        return;
      stale = false;
      lastLines = frame.fieldLines;
      lastEruption = eruption?.lines ?? null;
      lastXPoint = xPoint;
      count = 0;
      offset.fill(0);
      /* Behind an arcade the rest of the field steps back. */
      const background = eruption && eruption.lines.length > 0 ? ERUPTION_BACKGROUND : 1;
      for (const line of frame.fieldLines.slice(0, maxLines)) writeLine(line, background);
      if (eruption && region) {
        /* The model's arcade comes extruded slice by slice along the neutral line: the
           outermost slices are left out, every other line of a slice drawn, as glowing tubes,
           the middle slice brightest; the X-point is marked at the sheet's foot. */
        const lines = eruption.lines.slice(0, ERUPTION_MAX_LINES);
        const perSlice = Math.max(1, Math.ceil(lines.length / ARCADE_SLICES));
        const middle = (ARCADE_SLICES - 1) / 2;
        lines.forEach((line, i) => {
          const slice = Math.floor(i / perSlice);
          const off = Math.abs(slice - middle);
          if (off > middle - ARCADE_TRIM || i % ARCADE_STRIDE !== 0) return;
          writeLine(line, ARCADE_FALLOFF ** off, TUBE_WIDTH);
        });
        if (xPoint) {
          directionOf(region.lat, region.lon, dir);
          centre.set(dir[0], dir[1], dir[2]);
          bipoleAxis(region, dir);
          axis.set(dir[0], dir[1], dir[2]);
          writeCross(
            centre.clone().multiplyScalar(1 + eruption.sheetBottom),
            axis,
            eruption.reconnection,
          );
        }
      }
      geometry.instanceCount = count;
      for (const name of ["aPrev", "aStart", "aEnd", "aNext", "aLine", "aAlong", "aFade", "aTube"])
        geometry.getAttribute(name).needsUpdate = true;
      mesh.visible = shown && count > 0;
    },
    /** Half the halo's width, world per unit distance from the camera. */
    setHalfWidth(halfWidth: number) {
      uniforms.uHalfWidth.value = halfWidth;
    },
    /** How much the field shows in the current light. */
    setPresence(presence: number) {
      uniforms.uPresence.value = presence;
    },
  };
}
