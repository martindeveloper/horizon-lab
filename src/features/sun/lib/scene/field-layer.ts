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
import { keysOf, recordFrom } from "@horizon/toolkit/records";
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
import type { SunQuality } from "../quality";
import { type Polyline, type SunFrame } from "./frame";
import type { SunLooks } from "./looks";

/** A line's strength as drawn: a floor every line keeps, then a log scale up to the strongest. */
const strengthShown = (strength: number) =>
  RIBBON_FLOOR +
  (1 - RIBBON_FLOOR) *
    Math.min(1, Math.log1p(Math.max(strength, 0)) / Math.log1p(RIBBON_STRENGTH_TOP));

/** The farthest any ribbon reaches, radii: the atmosphere's bound covers every open line drawn. */
const REACH = 6;

/** A segment's instanced attributes: each buffer's attribute name and its floats per segment. */
const ATTRIBUTES = {
  prev: ["aPrev", 3],
  start: ["aStart", 3],
  end: ["aEnd", 3],
  next: ["aNext", 3],
  line: ["aLine", 4],
  along: ["aAlong", 2],
  fade: ["aFade", 1],
  tube: ["aTube", 1],
  seed: ["aSeed", 1],
} as const;
type BufferName = keyof typeof ATTRIBUTES;
const BUFFER_NAMES = keysOf(ATTRIBUTES);

type Buffers = Record<BufferName, Float32Array> & { capacity: number };

function buffers(capacity: number): Buffers {
  const arrays = recordFrom(
    BUFFER_NAMES,
    (name) => new Float32Array(capacity * ATTRIBUTES[name][1]),
  );
  return { ...arrays, capacity };
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
  /** The instanced attributes with their floats per segment, as uploaded. */
  let uploads: { attribute: InstancedBufferAttribute; size: number }[] = [];
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
    uploads = BUFFER_NAMES.map((name) => {
      const [attribute, size] = ATTRIBUTES[name];
      const instance = instanced(data![name], size);
      geometry!.setAttribute(attribute, instance);
      return { attribute: instance, size };
    });
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
  let lastBackground = -1;
  let count = 0;
  /** Segments the field's own lines fill, ahead of the eruption's. */
  let fieldCount = 0;
  /** One polyline's segments, resampled to at most `pointLimit` points. */
  function writeLine(line: Polyline, fade: number, tube = 1, pointLimit = maxPoints) {
    if (!data || line.count < 2) return;
    const { points } = line;
    const n = Math.min(line.count, pointLimit);
    const seed = points[0]! * 127.1 + points[1]! * 311.7 + points[2]! * 74.7;
    const strength = strengthShown(line.strength);
    const { prev, start, end, next } = data;
    const at = (i: number) =>
      Math.round((Math.min(Math.max(i, 0), n - 1) * (line.count - 1)) / (n - 1)) * 3;
    // Each segment's neighbours slide along: every resampled point is located once.
    let before = at(-1);
    let from = at(0);
    let to = at(1);
    for (let i = 0; i < n - 1; i++) {
      if (count >= data.capacity) return;
      const after = at(i + 2);
      const o = count * 3;
      for (let k = 0; k < 3; k++) {
        prev[o + k] = points[before + k]!;
        start[o + k] = points[from + k]!;
        end[o + k] = points[to + k]!;
        next[o + k] = points[after + k]!;
      }
      data.line[count * 4] = line.polarity;
      data.line[count * 4 + 1] = line.open ? 1 : 0;
      data.line[count * 4 + 2] = strength;
      data.line[count * 4 + 3] = line.kelvin;
      data.along[count * 2] = i / (n - 1);
      data.along[count * 2 + 1] = (i + 1) / (n - 1);
      data.fade[count] = fade;
      data.tube[count] = tube;
      data.seed[count] = seed;
      before = from;
      from = to;
      to = after;
      count++;
    }
  }

  return {
    setQuality(quality: SunQuality) {
      allocate(quality);
      stale = true;
    },
    /**
     * Draws the frame's lines when shown in a light that shows the field; the field's own lines
     * are rewritten when the field changes, the eruption's after them as it moves, and only the
     * segments written are uploaded.
     */
    update(frame: SunFrame, shown: boolean) {
      if (!geometry || !data || !mesh) return;
      const eruption = frame.eruption;
      const drawn = shown && uniforms.uPresence.value > 0;
      mesh.visible = drawn && count > 0;
      flowMesh.visible = drawn && !!eruption && eruption.reconnection > 0;
      if (!drawn) return;
      /* Behind an arcade the rest of the field steps back. */
      const background = eruption && eruption.lines.length > 0 ? ERUPTION_BACKGROUND : 1;
      const fieldChanged =
        stale || frame.fieldRevision !== lastLines || background !== lastBackground;
      if (!fieldChanged && frame.eruptionRevision === lastEruption) return;
      stale = false;
      lastLines = frame.fieldRevision;
      lastEruption = frame.eruptionRevision;
      lastBackground = background;
      if (eruption) {
        flowPosition.array.set(eruption.flow);
        flowPosition.needsUpdate = true;
        flowUniforms.uFlow.value = 0.15 * Math.sqrt(eruption.reconnection);
      }
      const from = fieldChanged ? 0 : fieldCount;
      if (fieldChanged) {
        count = 0;
        const lines = Math.min(frame.fieldLines.length, maxLines);
        for (let i = 0; i < lines; i++) writeLine(frame.fieldLines[i]!, background);
        fieldCount = count;
      } else count = fieldCount;
      const region = eruption ? frame.regions.find((r) => r.id === eruption.regionId) : undefined;
      if (eruption && region) {
        const middle = (ARCADE_SLICES - 1) / 2;
        const lines = Math.min(eruption.lines.length, ERUPTION_MAX_LINES);
        for (let i = 0; i < lines; i++) {
          const line = eruption.lines[i]!;
          const off = Math.abs(line.slice - middle);
          if (off > middle - ARCADE_TRIM) continue;
          // Keep paired upper and lower products equally sampled. A second uniform
          // downsample would erase the small flare loops and kink the expanding field.
          writeLine(line, ARCADE_FALLOFF ** off, TUBE_WIDTH, PLANE_LINE_POINTS);
        }
      }
      geometry.instanceCount = count;
      for (const { attribute, size } of uploads) {
        attribute.clearUpdateRanges();
        if (count > from) attribute.addUpdateRange(from * size, (count - from) * size);
        attribute.needsUpdate = true;
      }
      mesh.visible = count > 0;
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
