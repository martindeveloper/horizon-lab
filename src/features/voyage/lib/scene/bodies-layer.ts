/**
 * Every body at its true size, placed each frame by its offset from the ship (the floating
 * origin) in km: the Sun with its glow, the planets with their rings, the named small worlds
 * and the moons, each lit by the Sun from where the ship sees it, shadowing one another in
 * eclipses, and their orbits as faint lines. A moving ship sees each globe aberrated and
 * resized (`seen.ts`) and the orbit lines aberrated point by point (orbit.vert.glsl).
 * Reports each globe's size for the map budget.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  Mesh,
  RingGeometry,
  SphereGeometry,
  Sprite,
  Vector3,
  type Object3D,
  type ShaderMaterial,
} from "three";

import { moonOrientation } from "@/space/solar-system/graphics/moons";
import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import { writeMoonOrbit } from "@/space/solar-system/model/moon-orbits";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { ORBIT_COLOR } from "@/space/solar-system/scene/kit";
import {
  FIGURES,
  MAPS,
  RINGS,
  SUN_RADIUS_KM,
  createOrbitWriter,
  namedById,
  type BodyId,
} from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import {
  SOLAR_GOLD,
  STRONG,
  bodyOrientation,
  pickLevel,
  placeRelative,
  vec3d,
  type PlaceLabel,
  type Vec3d,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { motionUniforms, orbitMaterial } from "../graphics/looks";
import { isBodyAnchor, type AnchorId } from "../model/anchors";
import { WORLD_BODIES, bodyPositionKm, type WorldBody } from "../model/bodies";
import type { GlobeDetail } from "../quality";
import type { Frame, VoyageKit } from "./kit";
import { placeSeen } from "./seen";

/** Globe levels by on-screen radius (CSS px): fine, close, then the quality's finest. */
const SPHERE_PX = [36, 360, 1400] as const;
/** Below this on-screen radius a body is not drawn (it would be a flickering sub-pixel). */
const DRAW_PX = 0.3;
/** A body's name reads once it is this large on screen (eased over the span). */
const NAME_PX = [1.5, 3] as const;
/** Samples along an orbit's ellipse. */
const ORBIT_SEGMENTS = 256;
/** How far the Sun's glow reaches, in its radii. */
const GLOW_RADII = 2.8;

type Orbit = {
  line: Line;
  positions: Float32Array;
  geometry: BufferGeometry;
  material: ShaderMaterial;
  color: number;
  /** The day the ellipse was last written for. */
  day: number;
};

type Slot = {
  body: WorldBody;
  mesh: Mesh;
  /** Heliocentric position this frame, km. */
  pos: Vec3d;
  /** The host whose place this moon is offset from. */
  host: Slot | null;
  /** The bodies of its own system that may stand before the Sun. */
  shadowers: Slot[];
  /** Mean radius, km, and the oblate figure's equatorial and polar factors. */
  radius: number;
  shape: readonly [number, number];
  ring: ShaderMaterial | null;
  orbit: Orbit | null;
};

const shapeOf = (id: BodyId) =>
  [
    FIGURES[id].equatorialKm / FIGURES[id].meanKm,
    FIGURES[id].polarKm / FIGURES[id].meanKm,
  ] as const;

const ORIGIN = vec3d();

function pickOf(body: WorldBody): SolarSelection {
  switch (body.kind) {
    case "sun":
      return { kind: "sun" };
    case "planet":
      return { kind: "planet", id: body.id };
    case "named":
      return { kind: "named", id: body.id };
    case "moon":
      return { kind: "moon", id: body.id };
  }
}

function orbitColor(body: WorldBody) {
  switch (body.kind) {
    case "planet":
      return ORBIT_COLOR[body.id];
    case "moon":
      return body.host === "pluto" ? 0x9ebccc : ORBIT_COLOR[body.host];
    case "named":
      return body.id === "halley" ? 0xc4705a : 0x9ebccc;
    case "sun":
      return 0;
  }
}

export function createBodiesLayer(
  kit: VoyageKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    globe: GlobeDetail;
  },
) {
  const { scope, looks, lod } = kit;
  const { place } = deps;
  /* Globes: coarse while a body is small, finer as it fills the view. */
  const coarse = scope.own(new SphereGeometry(1, 24, 16));
  const fine = scope.own(new SphereGeometry(1, 72, 48));
  const close = scope.own(new SphereGeometry(1, 128, 80));
  const levels: BufferGeometry[] = [
    coarse,
    fine,
    close,
    new SphereGeometry(1, deps.globe.segments, deps.globe.rings),
  ];
  scope.defer(() => levels[3]!.dispose());
  const fit = (mesh: Mesh, rPx: number) => {
    const current = Math.max(0, levels.indexOf(mesh.geometry));
    mesh.geometry = levels[pickLevel(current, rPx, SPHERE_PX)]!;
  };

  looks.sunRadius.value = SUN_RADIUS_KM;
  /* The ship's motion, for the orbit lines' aberration; written each frame. */
  const motion = motionUniforms();

  const slots: Slot[] = WORLD_BODIES.map((body) => {
    const material =
      body.kind === "sun"
        ? looks.sun
        : body.kind === "planet"
          ? looks.planets[body.id]
          : body.kind === "named"
            ? looks.named[body.id]
            : looks.moon(body.id);
    const mesh = new Mesh(coarse, material);
    mesh.userData.pick = pickOf(body);
    mesh.userData.globe = mesh;
    mesh.visible = false;
    parent.add(mesh);
    let ring: ShaderMaterial | null = null;
    if (body.kind === "planet") {
      const system = RINGS[body.id];
      const look = looks.rings[body.id];
      if (system && look) {
        const eq = FIGURES[body.id].equatorialKm;
        const geometry = new RingGeometry(system.innerKm / eq, system.outerKm / eq, 512, 4);
        const disc = new Mesh(scope.own(geometry), look);
        disc.rotation.x = -Math.PI / 2;
        disc.renderOrder = 1;
        mesh.add(disc);
        ring = look;
      }
    }
    let orbit: Orbit | null = null;
    if (body.kind !== "sun") {
      const color = orbitColor(body);
      const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
      const geometry = scope.own(new BufferGeometry());
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const material = scope.own(orbitMaterial(motion, color, 0.35));
      const line = new Line(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      parent.add(line);
      orbit = { line, positions, geometry, material, color, day: NaN };
    }
    return {
      body,
      mesh,
      pos: vec3d(),
      host: null,
      shadowers: [],
      radius: FIGURES[body.id].meanKm,
      shape: shapeOf(body.id),
      ring,
      orbit,
    };
  });
  const byId = new Map(slots.map((slot) => [slot.body.id, slot]));
  /* Each moon knows its host; each body the moons that may shade it, a moon its host too. */
  for (const slot of slots) {
    const { body } = slot;
    if (body.kind === "moon") {
      slot.host = byId.get(body.host)!;
      slot.shadowers.push(slot.host);
    }
    if (body.kind === "sun") continue;
    const system = body.kind === "moon" ? body.host : body.id;
    for (const other of slots)
      if (other !== slot && other.body.kind === "moon" && other.body.host === system)
        slot.shadowers.push(other);
  }

  const glow = new Sprite(looks.sunGlow);
  glow.scale.set(SUN_RADIUS_KM * GLOW_RADII, SUN_RADIUS_KM * GLOW_RADII, 1);
  parent.add(glow);

  const poleWorld = new Vector3();
  const sunDir = vec3d();
  const names = lod.fader();
  const orbits = lod.fader();
  /* Orbit writers in au, scaled to km by the line: the buffer's floats stay small. */
  const writers = new Map<BodyId, ReturnType<typeof createOrbitWriter>>();

  /** Fills a body's eclipse slots with those of its shadowers that stand before the Sun. */
  const occlude = (slot: Slot, ship: Vec3d) => {
    const uniforms = looks.occludersOf(slot.body.id);
    if (!uniforms) return;
    let k = 0;
    for (const other of slot.shadowers) {
      if (k >= uniforms.length) break;
      /* Between this body and the Sun: ahead along the Sun's direction, and roughly in line. */
      const dx = other.pos[0] - slot.pos[0];
      const dy = other.pos[1] - slot.pos[1];
      const dz = other.pos[2] - slot.pos[2];
      const along = dx * sunDir[0] + dy * sunDir[1] + dz * sunDir[2];
      if (along <= 0) continue;
      const lateral = Math.hypot(
        dx - sunDir[0] * along,
        dy - sunDir[1] * along,
        dz - sunDir[2] * along,
      );
      if (lateral > slot.radius + other.radius * 1.5) continue;
      uniforms[k]!.set(
        other.pos[0] - ship[0],
        other.pos[1] - ship[1],
        other.pos[2] - ship[2],
        other.radius,
      );
      k += 1;
    }
    for (; k < uniforms.length; k += 1) uniforms[k]!.w = 0;
  };

  /** A body's orbit about its focus, drawn when orbits are on and it is the aim's system's. */
  const updateOrbit = (
    slot: Slot,
    now: Date,
    ship: Vec3d,
    on: number,
    selected: boolean,
    aim: AnchorId,
  ) => {
    const orbit = slot.orbit!;
    const { body } = slot;
    const aimBody = isBodyAnchor(aim) ? byId.get(aim)!.body : null;
    const ofSystem =
      body.kind !== "moon" ||
      (aimBody !== null &&
        (aimBody.kind === "moon" ? aimBody.host === body.host : aimBody.id === body.host));
    const presence = on * (ofSystem || selected ? 1 : 0);
    orbit.line.visible = presence > 0.004;
    if (!orbit.line.visible) return;
    orbit.material.uniforms.opacity!.value = (selected ? 0.8 : 0.35) * presence;
    orbit.material.uniforms.color!.value.set(selected ? SOLAR_GOLD : orbit.color);
    const day = Math.floor(now.getTime() / 86_400_000);
    if (orbit.day !== day) {
      orbit.day = day;
      if (body.kind === "moon") writeMoonOrbit(orbit.positions, body.id, now);
      else if (body.kind !== "sun") {
        let writer = writers.get(body.id);
        if (!writer) writers.set(body.id, (writer = createOrbitWriter(orbit.positions)));
        const el =
          body.kind === "planet"
            ? planetElements(body.id, 1, 0, now)
            : namedElements(namedById(body.id), 1, 0, now);
        writer(el, true);
      }
      orbit.geometry.getAttribute("position").needsUpdate = true;
    }
    /* The ellipse is in au about its focus; the line scales it to km at the focus's place. */
    const focus = body.kind === "moon" ? byId.get(body.host)!.pos : ORIGIN;
    placeRelative(orbit.line, focus, ship);
    orbit.line.scale.setScalar(AU_KM);
  };

  return {
    /** Everything a tap may land on. */
    pickables: slots.map((slot) => slot.mesh),
    labelBodies: slots.map((slot) => ({ key: slot.body.id, mesh: slot.mesh })),
    /** A body's heliocentric position as drawn this frame, km. */
    positionOf: (id: BodyId): Readonly<Vec3d> => byId.get(id)!.pos,
    /** Every body with its position as drawn this frame, km (the scanner's blips). */
    positions: slots.map((slot) => ({
      id: slot.body.id as string,
      pos: slot.pos as Readonly<Vec3d>,
    })),
    /** The body whose surface is nearest a point, km, heliocentric. */
    nearest(at: ArrayLike<number>): BodyId {
      let best: Slot = slots[0]!;
      let bestGap = Infinity;
      for (const slot of slots) {
        const gap =
          Math.hypot(slot.pos[0] - at[0]!, slot.pos[1] - at[1]!, slot.pos[2] - at[2]!) -
          slot.radius;
        if (gap < bestGap) {
          bestGap = gap;
          best = slot;
        }
      }
      return best.body.id;
    },
    /** The quality's finest globe changed. */
    setGlobe(detail: GlobeDetail) {
      const top = levels[3]!;
      const next = new SphereGeometry(1, detail.segments, detail.rings);
      for (const slot of slots) if (slot.mesh.geometry === top) slot.mesh.geometry = next;
      top.dispose();
      levels[3] = next;
    },
    update({ now, show, sel, ship, aim, motion: moving }: Frame) {
      const labelled = names.to(show.names);
      const orbitsOn = orbits.to(show.orbits);
      motion.beta.value = moving.beta;
      motion.gamma.value = moving.gamma;
      motion.forward.fromArray(moving.forward);
      /* The Sun as every surface sees it: from the ship's origin. */
      looks.sunPos.set(-ship[0], -ship[1], -ship[2]);
      /* Hosts come before their moons, so a moon is placed from its host's place this frame. */
      for (const slot of slots) bodyPositionKm(slot.body.id, now, slot.pos, slot.host?.pos);
      for (const slot of slots) {
        const { body, mesh, pos, radius, shape } = slot;
        placeSeen(mesh, pos, ship, moving);
        const [eq, polar] = shape;
        mesh.scale.set(radius * eq, radius * polar, radius * eq);
        const rPx = lod.px(radius * eq, mesh.position);
        const selected =
          (sel?.kind === "planet" || sel?.kind === "named" || sel?.kind === "moon") &&
          sel.id === body.id;
        /* The orbit shows whatever the globe's size: a line is read from anywhere. */
        if (slot.orbit) updateOrbit(slot, now, ship, orbitsOn, selected, aim);
        const drawn = rPx >= DRAW_PX;
        mesh.visible = drawn;
        if (!drawn) {
          place(body.id, mesh.position.x, mesh.position.y, mesh.position.z, 0);
          continue;
        }
        if (body.kind === "moon") moonOrientation(body.id, now, mesh.quaternion);
        else bodyOrientation(body.id, now, mesh.quaternion);
        fit(mesh, rPx);
        if (MAPS[body.id]) lod.see(body.id, rPx);
        if (slot.ring && body.kind === "planet") {
          poleWorld.set(0, 1, 0).applyQuaternion(mesh.quaternion);
          const pole = slot.ring.uniforms.pole?.value;
          if (pole instanceof Vector3) pole.copy(poleWorld);
          slot.ring.uniforms.radius!.value = radius * eq;
          const globe = looks.planets[body.id].uniforms;
          if (globe.ringPole) {
            const ringPole = globe.ringPole.value;
            if (ringPole instanceof Vector3) ringPole.copy(poleWorld);
            globe.ringRadius!.value = radius * eq;
          }
        }
        if (body.kind !== "sun") {
          /* The Sun's direction from this body, for its eclipses. */
          const len = Math.hypot(pos[0], pos[1], pos[2]) || 1;
          sunDir[0] = -pos[0] / len;
          sunDir[1] = -pos[1] / len;
          sunDir[2] = -pos[2] / len;
          occlude(slot, ship);
        }
        const named = body.id === aim ? 1 : smoothstep(NAME_PX[0], NAME_PX[1], rPx);
        place(
          body.id,
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
          labelled * named,
          body.kind === "sun" || selected ? STRONG : undefined,
        );
      }
      const sun = byId.get("sun")!;
      glow.visible = sun.mesh.visible;
      glow.position.copy(sun.mesh.position);
    },
  };
}
