import { Mesh, SphereGeometry, Sprite, type Object3D, type WebGLRenderer } from "three";

import { createBrush } from "@/space/brush";
import { SPACECRAFT } from "@/space/spacecraft/models";
import { createSpacecraftPass, type Craft } from "@/space/spacecraft/scene/spacecraft-pass";
/**
 * The great observatories near Earth (`../model/observatories`): each a marker and a name where
 * it is today, its orbit about the Earth the scene draws (Webb's halo as it looks turning with
 * Earth round the Sun), and at its true size (`@/space/spacecraft`) once the camera closes on
 * it, its solar arrays (Webb: its sunshield) turned to the Sun. Like the Moon they keep their
 * true distances, so they show only while Earth's system is drawn at its true scale and they
 * clear Earth's marker, and only in the present.
 */
import { orbitShapeOf, type Vec3 } from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import {
  ownedLine,
  ownedOrbitLine,
  rising,
  type OrbitLine,
  type PlaceLabel,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { createReachLooks } from "../graphics/reach-looks";
import {
  OBSERVATORIES,
  WEBB_HALO_POINTS,
  isObservatorySelection,
  isSatellite,
  observatoryOffset,
  satelliteShape,
  webbHalo,
  type ObservatoryId,
  type ObservatorySelection,
  type SatelliteId,
} from "../model/observatories";
import { ORBIT_COLOR, type SolarKit } from "./kit";
import { SEPARATE_PX, type MoonHosts } from "./moons-layer";

/** Their orbits: Earth's colour, as the Moon's, a little brighter for the one picked. */
const ORBIT_OPACITY = 0.45;
const PICKED_OPACITY = 0.7;
const ORBIT_SEGMENTS = 192;
/** Marker sizes, px, as the probes'; touch targets. */
const MARKER_PX = 11;
const PICKED_PX = 16;
const TOUCH_PX = 14;
/** They fade as Earth's moon is drawn past its true distance, gone by this magnification. */
const MAGNIFIED_OUT = 1.25;
const M_PER_AU = AU_KM * 1e3;

/** Where things are this frame for the observatories, in the scene's au. */
export type ObservatoriesFrame = {
  dt: number;
  now: Date;
  /** Today, not the timeline's past: they exist only now. */
  present: boolean;
  names: boolean;
  sel: { kind: string } | null;
  /** The planets as the moons layer records them, Earth among them, and Earth's moon's magnification (1: true). */
  hosts: MoonHosts;
  magnified: number;
  /**
   * The camera, as a point the host holds exactly (the orbit's aim) and its offset from there:
   * a craft is placed from the camera by both, never by a rounded camera position.
   */
  base: Readonly<Vec3>;
  offset: Readonly<Vec3>;
  /** The observatory the camera is closing on. */
  approach: ObservatoryId | null;
};

/** An orbit as drawn: Webb's halo is a line through its track, the others Kepler ellipses. */
type Orbit =
  | { kind: "halo"; slot: ReturnType<typeof ownedLine> }
  | { kind: "ellipse"; id: SatelliteId; slot: OrbitLine };

export function createObservatoriesLayer(
  kit: SolarKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    /** An observatory's own name, orbit and marker fade as its close-up fills the view. */
    shownFor: (id: ObservatoryId) => number;
    invalidate: () => void;
  },
) {
  const { scope, camera, pxWorld, lod } = kit;
  const brush = createBrush();
  const looks = createReachLooks(brush);
  scope.defer(() => {
    looks.dispose();
    brush.dispose();
  });
  const pass = createSpacecraftPass(kit, { unitM: M_PER_AU, invalidate: deps.invalidate });
  const hitGeometry = scope.own(new SphereGeometry(1, 8, 6));
  const shape = orbitShapeOf();
  const slots = OBSERVATORIES.map(({ id, model }) => {
    const marker = new Sprite(looks.probe);
    const hit = new Mesh(hitGeometry, looks.ghost);
    hit.userData.pick = { kind: "observatory", id } satisfies ObservatorySelection;
    hit.userData.globe = marker;
    const orbit: Orbit = isSatellite(id)
      ? {
          kind: "ellipse",
          id,
          slot: ownedOrbitLine(scope, ORBIT_COLOR.earth, ORBIT_OPACITY, ORBIT_SEGMENTS),
        }
      : {
          kind: "halo",
          slot: ownedLine(scope, ORBIT_COLOR.earth, ORBIT_OPACITY, WEBB_HALO_POINTS - 1),
        };
    const { line } = orbit.slot;
    marker.visible = hit.visible = line.visible = false;
    parent.add(marker, hit, line);
    const craft: Craft = { key: id, model, at: [0, 0, 0], facing: [0, 0, 0] };
    const sunward = SPACECRAFT[model].face.toward === "sun";
    return { id, marker, hit, orbit, craft, sunward, at: [0, 0, 0] as Vec3 };
  });
  const crafts = slots.map((slot) => slot.craft);
  const present = lod.fader();
  const names = lod.fader();
  const earth: Vec3 = [0, 0, 0];
  const sun: Vec3 = [0, 0, 0];
  let reach = 0;

  /** Draws an orbit about Earth; returns how far from Earth it reaches, au. */
  function drawOrbit(orbit: Orbit, now: Date) {
    if (orbit.kind === "ellipse") {
      orbit.slot.set(satelliteShape(orbit.id, now, shape));
      return shape.a * (1 + shape.e);
    }
    const { positions, geometry } = orbit.slot;
    webbHalo(now, earth, positions);
    geometry.attributes.position!.needsUpdate = true;
    let far = 0;
    for (let i = 0; i < positions.length; i += 3)
      far = Math.max(far, Math.hypot(positions[i]!, positions[i + 1]!, positions[i + 2]!));
    return far;
  }

  return {
    /** Everything the layer draws in the scene, for a close-up's depth pass about Earth. */
    objects: slots.flatMap((slot): Object3D[] => [slot.marker, slot.hit, slot.orbit.slot.line]),
    pickables: slots.map((slot) => slot.hit),
    /** How far from Earth's centre the drawn orbits reach, au; 0 while none shows. */
    get reach() {
      return reach;
    },
    /** What a tap on a name opens. */
    labelPick(key: string): ObservatorySelection | undefined {
      const slot = slots.find((s) => s.id === key);
      return slot && { kind: "observatory", id: slot.id };
    },
    update(frame: ObservatoriesFrame) {
      const { now, sel, approach, base, offset } = frame;
      const host = frame.hosts.get("earth");
      const fromCamera = (k: number, v: number) => v - base[k]! - offset[k]!;
      for (let k = 0; k < 3; k++) sun[k] = fromCamera(k, 0);
      if (host) host.position.toArray(earth);
      const on =
        present.to(frame.present) *
        (1 - rising(frame.magnified, 1, MAGNIFIED_OUT)) *
        (host?.on ? 1 : 0);
      const labelled = names.to(frame.names);
      /* Pixels per world unit at Earth, for how far each clears its marker. */
      const range = host ? Math.max(1e-12, camera.position.distanceTo(host.position)) : 1;
      const perPx = 1 / pxWorld(range, 1);
      reach = 0;
      for (const { id, marker, hit, orbit, craft, sunward, at } of slots) {
        observatoryOffset(id, now, earth, at);
        const clear = host ? (Math.hypot(at[0], at[1], at[2]) - host.extent) * perPx : 0;
        const shown = on * smoothstep(SEPARATE_PX[0], SEPARATE_PX[1], clear) * deps.shownFor(id);
        const picked = isObservatorySelection(sel) && sel.id === id;
        /* Closing on it, the marker gives way to the model. */
        const presence = approach === id ? (1 - pass.presence(id)) * deps.shownFor(id) : shown;
        marker.position.set(earth[0] + at[0], earth[1] + at[1], earth[2] + at[2]);
        marker.visible = hit.visible = presence > 0.004;
        if (marker.visible) {
          const near = Math.max(1e-15, camera.position.distanceTo(marker.position));
          marker.scale.setScalar(pxWorld(near, picked ? PICKED_PX : MARKER_PX) * presence);
          hit.position.copy(marker.position);
          hit.scale.setScalar(pxWorld(near, TOUCH_PX));
        }
        const { line, material } = orbit.slot;
        line.visible = shown > 0.004;
        if (line.visible) {
          line.position.fromArray(earth);
          material.opacity = (picked ? PICKED_OPACITY : ORBIT_OPACITY) * shown;
          reach = Math.max(reach, drawOrbit(orbit, now));
        }
        deps.place(
          id,
          marker.position.x,
          marker.position.y,
          marker.position.z,
          labelled * presence,
        );
        for (let k = 0; k < 3; k++) {
          craft.at[k] = fromCamera(k, earth[k]! + at[k]!);
          craft.facing[k] = sunward ? sun[k]! : fromCamera(k, earth[k]!);
        }
      }
      pass.update({ dt: frame.dt, sun, crafts, approach });
    },
    /** After the scene's passes: each observatory near enough to show at its true size. */
    render: (renderer: WebGLRenderer) => pass.render(renderer),
    /** An observatory is big enough on screen to show, and its model is still on its way. */
    get waiting() {
      return pass.waiting;
    },
  };
}
