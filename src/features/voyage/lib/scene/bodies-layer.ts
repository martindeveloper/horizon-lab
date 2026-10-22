/**
 * Every body at its true size, placed each frame by its offset from the ship (the floating
 * origin) in km: the Sun with its glow, the planets with their rings, the named small worlds
 * and the moons, each lit by the Sun from where the ship sees it, shadowing one another in
 * eclipses, and their orbits as faint lines. A moving ship sees each globe aberrated and
 * resized (`seen.ts`) and the orbit lines aberrated point by point (orbit.vert.glsl). The
 * places come from the engine's anchor cache, so a frame solves each body's ephemeris once.
 * Reports each globe's size for the map budget.
 */
import {
  Line,
  Mesh,
  RingGeometry,
  Sprite,
  Vector3,
  type Object3D,
  type ShaderMaterial,
} from "three";

import { moonOrientation } from "@/space/solar-system/graphics/moons";
import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import { moonOrbitShape } from "@/space/solar-system/model/moon-orbits";
import { COMET_ORBIT_COLOR, ORBIT_COLOR, SMALL_ORBIT_COLOR } from "@/space/solar-system/scene/kit";
import {
  FIGURES,
  MAPS,
  RINGS,
  SUN_RADIUS_KM,
  namedById,
  orbitShape,
  orbitShapeOf,
  type BodyId,
} from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import {
  SOLAR_GOLD,
  STRONG,
  bodyOrientation,
  orbitGeometry,
  orbitUniforms,
  placeRelative,
  vec3d,
  writeOrbitUniforms,
  type OrbitUniforms,
  type PlaceLabel,
  type Vec3d,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { orbitMaterial, type MotionUniforms } from "../graphics/looks";
import { isBodyAnchor, type AnchorId } from "../model/anchors";
import { WORLD_BODIES, selectionOfBody, type WorldBody } from "../model/bodies";
import { DRAW_PX, GLOW_RADII, NAME_PX, type Globes } from "./globes";
import type { Frame, VoyageKit } from "./kit";
import { placeSeen } from "./seen";

/** Samples along an orbit's ellipse. */
const ORBIT_SEGMENTS = 256;

type Orbit = {
  line: Line;
  material: ShaderMaterial;
  /** The ellipse the GPU builds the line on, au about its focus. */
  uniforms: OrbitUniforms;
  color: number;
};

type Slot = {
  body: WorldBody;
  mesh: Mesh;
  /** Heliocentric position this frame, km. */
  pos: Vec3d;
  /** The planet this moon orbits. */
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

function orbitColor(body: WorldBody) {
  switch (body.kind) {
    case "planet":
      return ORBIT_COLOR[body.id];
    case "moon":
      return body.host === "pluto" ? SMALL_ORBIT_COLOR : ORBIT_COLOR[body.host];
    case "named":
      return body.id === "halley" ? COMET_ORBIT_COLOR : SMALL_ORBIT_COLOR;
    case "sun":
      return 0;
  }
}

export function createBodiesLayer(
  kit: VoyageKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    globes: Globes;
    /** The ship's motion, for the orbit lines' aberration. */
    motion: MotionUniforms;
    /** Where a body is at a date, km, heliocentric: the engine's anchor cache. */
    at: (id: AnchorId, date: Date, out: Vec3d) => Vec3d;
  },
) {
  const { scope, looks, lod } = kit;
  const { place, globes, motion, at } = deps;
  looks.sunRadius.value = SUN_RADIUS_KM;
  /* Every orbit line draws the same static samples; its uniforms make them its ellipse. */
  const orbitSamples = orbitGeometry(scope, ORBIT_SEGMENTS);

  const slots: Slot[] = WORLD_BODIES.map((body) => {
    const material =
      body.kind === "sun"
        ? looks.sun
        : body.kind === "planet"
          ? looks.planets[body.id]
          : body.kind === "named"
            ? looks.named[body.id]
            : looks.moon(body.id);
    const mesh = new Mesh(globes.coarse, material);
    mesh.userData.pick = selectionOfBody(body);
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
      const uniforms = orbitUniforms();
      const material = scope.own(orbitMaterial(motion, uniforms, color, 0.35));
      const line = new Line(orbitSamples, material);
      line.frustumCulled = false;
      line.visible = false;
      parent.add(line);
      orbit = { line, material, uniforms, color };
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
  const shape = orbitShapeOf();
  const nearest = { id: "sun" as BodyId, gap: Infinity };

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
    if (body.kind === "moon") moonOrbitShape(body.id, now, shape);
    else if (body.kind !== "sun") {
      const el =
        body.kind === "planet"
          ? planetElements(body.id, 1, 0, now)
          : namedElements(namedById(body.id), 1, 0, now);
      orbitShape(el, true, shape);
    }
    writeOrbitUniforms(orbit.uniforms, shape);
    /* The ellipse is in au about its focus, so its numbers stay small; the line scales it to
       km at the focus's place, relative to the ship (the floating origin). */
    const focus = body.kind === "moon" ? byId.get(body.host)!.pos : ORIGIN;
    placeRelative(orbit.line, focus, ship);
    orbit.line.scale.setScalar(AU_KM);
  };

  return {
    /** Everything a tap may land on. */
    pickables: slots.map((slot) => slot.mesh),
    labelBodies: slots.map((slot) => ({ key: slot.body.id, mesh: slot.mesh })),
    /** Every body with its position as drawn this frame, km (the scanner's blips). */
    positions: slots.map((slot) => ({
      id: slot.body.id as string,
      pos: slot.pos as Readonly<Vec3d>,
    })),
    /** The body whose surface is nearest a point (km, heliocentric), and how far it is (a reused object). */
    nearest(at: ArrayLike<number>) {
      nearest.gap = Infinity;
      for (const slot of slots) {
        const gap =
          Math.hypot(slot.pos[0] - at[0]!, slot.pos[1] - at[1]!, slot.pos[2] - at[2]!) -
          slot.radius;
        if (gap < nearest.gap) {
          nearest.gap = gap;
          nearest.id = slot.body.id;
        }
      }
      return nearest;
    },
    update({ now, show, sel, ship, aim, motion: moving }: Frame) {
      const labelled = names.to(show.names);
      const orbitsOn = orbits.to(show.orbits);
      looks.exposeRings(show.faintRings);
      /* The Sun as every surface sees it: from the ship's origin. */
      looks.sunPos.set(-ship[0], -ship[1], -ship[2]);
      for (const slot of slots) at(slot.body.id, now, slot.pos);
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
        globes.fit(mesh, rPx);
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
