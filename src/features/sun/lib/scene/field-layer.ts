/**
 * Field lines and loops as instanced ribbons: one instance per segment, each knowing its
 * neighbours so the vertex shader mitres the joins (`ribbon.vert.glsl`); width in CSS pixels,
 * soft edges, added to the frame and depth-tested against the globe. The eruption's lines are
 * extruded from one reconnecting cross-section along the region's neutral line.
 * The buffers follow the eruption's time even though its model arrays are reused.
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

import { PLANE_LINE_POINTS } from "@/space/sun/model/eruption";
import { FLOW_PARTICLES } from "@/space/sun/model/eruption-flow";
import { ARCADE_SLICES } from "@/space/sun/model/parameters";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import FLOW_FRAG from "../graphics/flow.frag.glsl";
import FLOW_VERT from "../graphics/flow.vert.glsl";
import type { createLightTables } from "../graphics/light-tables";
import RIBBON_FRAG from "../graphics/ribbon.frag.glsl";
import RIBBON_VERT from "../graphics/ribbon.vert.glsl";
import {
  ARCADE_FALLOFF,
  ARCADE_TRIM,
  ERUPTION_BACKGROUND,
  ERUPTION_MAX_LINES,
  RIBBON_FLOOR,
  RIBBON_MAX_POINTS,
  RIBBON_STRENGTH_TOP,
  TUBE_WIDTH,
} from "../parameters";

/** A line's strength as drawn: a floor every line keeps, then a log scale up to the strongest. */
const shown = (strength: number) =>
  RIBBON_FLOOR +
  (1 - RIBBON_FLOOR) *
    Math.min(1, Math.log1p(Math.max(strength, 0)) / Math.log1p(RIBBON_STRENGTH_TOP));
import type { SunQuality } from "../quality";
import { type Polyline, type SunFrame } from "./frame";
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
  seed: Float32Array;
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
    seed: new Float32Array(capacity),
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
  const flowGeometry = scope.own(new InstancedBufferGeometry());
  flowGeometry.setAttribute(
    "position",
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3),
  );
  flowGeometry.setIndex([0, 1, 2, 2, 1, 3]);
  const flowPosition = new InstancedBufferAttribute(
    new Float32Array(3 * FLOW_PARTICLES),
    3,
  ).setUsage(DynamicDrawUsage);
  flowGeometry.setAttribute("aPosition", flowPosition);
  flowGeometry.instanceCount = FLOW_PARTICLES;
  const flowUniforms = { ...uniforms, uFlow: { value: 0 } };
  const flowMaterial = scope.own(
    new ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      uniforms: flowUniforms,
      blending: AdditiveBlending,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }),
  );
  const flowMesh = new Mesh(flowGeometry, flowMaterial);
  flowMesh.name = "Reconnection plasma";
  flowMesh.frustumCulled = false;
  flowMesh.visible = false;
  flowMesh.renderOrder = 2;
  scene.add(flowMesh);
  scope.defer(() => flowMesh.removeFromParent());
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
    const capacity = maxLines * (maxPoints - 1) + ERUPTION_MAX_LINES * (PLANE_LINE_POINTS - 1);
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
    geometry.setAttribute("aSeed", instanced(data.seed, 1));
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
  let lastLines = -1;
  let lastEruption = -1;
  let count = 0;
  const offset: [number, number, number] = [0, 0, 0];

  /** One polyline's segments, resampled to at most `maxPoints` points, shifted by `offset`. */
  function writeLine(line: Polyline, fade: number, tube = 1, pointLimit = maxPoints) {
    if (!data || line.count < 2) return;
    const n = Math.min(line.count, pointLimit);
    const seed = line.points[0]! * 127.1 + line.points[1]! * 311.7 + line.points[2]! * 74.7;
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
      data.seed[count] = seed;
      count++;
    }
  }

  return {
    setQuality(quality: SunQuality) {
      allocate(quality);
      stale = true;
    },
    update(frame: SunFrame, shown: boolean) {
      if (!geometry || !data || !mesh) return;
      mesh.visible = shown && count > 0;
      const eruption = frame.eruption;
      flowMesh.visible = shown && !!eruption && eruption.reconnection > 0;
      const region = eruption ? frame.regions.find((r) => r.id === eruption.regionId) : undefined;
      if (!stale && frame.fieldRevision === lastLines && frame.eruptionRevision === lastEruption)
        return;
      stale = false;
      lastLines = frame.fieldRevision;
      lastEruption = frame.eruptionRevision;
      count = 0;
      if (eruption) {
        flowPosition.array.set(eruption.flow);
        flowPosition.needsUpdate = true;
        flowUniforms.uFlow.value = 0.15 * Math.sqrt(eruption.reconnection);
      }
      offset.fill(0);
      /* Behind an arcade the rest of the field steps back. */
      const background = eruption && eruption.lines.length > 0 ? ERUPTION_BACKGROUND : 1;
      for (const line of frame.fieldLines.slice(0, maxLines)) writeLine(line, background);
      if (eruption && region) {
        const middle = (ARCADE_SLICES - 1) / 2;
        for (const line of eruption.lines.slice(0, ERUPTION_MAX_LINES)) {
          const off = Math.abs(line.slice - middle);
          if (off > middle - ARCADE_TRIM) continue;
          // Keep paired upper and lower products equally sampled. A second uniform
          // downsample would erase the small flare loops and kink the expanding field.
          writeLine(line, ARCADE_FALLOFF ** off, TUBE_WIDTH, PLANE_LINE_POINTS);
        }
      }
      geometry.instanceCount = count;
      for (const name of [
        "aPrev",
        "aStart",
        "aEnd",
        "aNext",
        "aLine",
        "aAlong",
        "aFade",
        "aTube",
        "aSeed",
      ])
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
