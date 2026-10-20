/**
 * Our reach, in the solar system's scales: how far sunlight gets in a given time (rings in
 * the ecliptic, ten light-minutes to a light-year), the heliopause where the Sun's wind gives
 * way to the gas between the stars, and the five probes past the planets on their real tracks,
 * where they are today.
 */
import { Mesh, Quaternion, SphereGeometry, Sprite, Vector3, type Object3D } from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import {
  BELOW,
  ownedLine,
  rising,
  type AnchoredRulers,
  type PlaceLabel,
} from "@horizon/toolkit/scene";

import {
  HELIOPAUSE_AU,
  LIGHT_RINGS,
  PROBES,
  probePath,
  probePosition,
  yearOf,
} from "../model/probes";
import type { Selection } from "../store";
import type { Frame, SceneKit } from "./kit";
import type { LabelPicks } from "./label-picks";

const RING_SEGMENTS = 192;
const RING_COLOR = 0x8ea4ba;
const RING_OPACITY = 0.3;
const TRAIL_COLOR = 0xdbe8f2;
const TRAIL_OPACITY = 0.32;
const LIMB_COLOR = 0xe2c99a;
const LIMB_OPACITY = 0.38;
/* The probes are what the heliosphere view is about: their names win over the rings'. */
const PROBE_LABEL = { strong: true, below: true } as const;

/** A ring reads once it spans a few per cent of the view, until it runs well past the frame. */
const ringShown = (r: number, dist: number) =>
  rising(r / dist, 0.025, 0.06) * (1 - rising(r / dist, 1.5, 3));
/** The probes cluster round the Sun from the Oort cloud out, and sit off-frame round the planets. */
const probeShown = (r: number, dist: number) =>
  rising(r / dist, 0.012, 0.03) * (1 - rising(r / dist, 2.2, 3));
const bubbleShown = (dist: number) =>
  rising(HELIOPAUSE_AU / dist, 0.02, 0.05) * (1 - rising(HELIOPAUSE_AU / dist, 1.2, 2));

export function createReachLayer(
  { scope, looks, camera, pxWorld, lod }: SceneKit,
  parent: Object3D,
  deps: { place: PlaceLabel; rulers: AnchoredRulers; picks: LabelPicks },
) {
  const { place, rulers } = deps;

  const rings = LIGHT_RINGS.map((ring) => {
    const slot = ownedLine(scope, RING_COLOR, RING_OPACITY, RING_SEGMENTS);
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      slot.positions.set([Math.cos(a) * ring.au, 0, Math.sin(a) * ring.au], i * 3);
    }
    parent.add(slot.line);
    return { ...ring, ...slot };
  });

  /* The bubble: a faint fill, and its limb, the circle where the sightline grazes it. */
  const bubble = new Mesh(scope.own(new SphereGeometry(HELIOPAUSE_AU, 48, 32)), looks.heliopause);
  bubble.renderOrder = -1;
  const bubbleOpacity = looks.heliopause.opacity;
  const limb = ownedLine(scope, LIMB_COLOR, LIMB_OPACITY, RING_SEGMENTS);
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    limb.positions.set([Math.cos(a), Math.sin(a), 0], i * 3);
  }
  parent.add(bubble, limb.line);

  /* The probes where they are today, each with its path since launch and a touch target. */
  const year = yearOf(new Date());
  const hitGeometry = scope.own(new SphereGeometry(1, 8, 6));
  const probes = PROBES.map((probe) => {
    const at = probePosition(probe.id, year, [0, 0, 0] as Vec3);
    const path = probePath(probe.id, year);
    const trail = ownedLine(scope, TRAIL_COLOR, TRAIL_OPACITY, path.length / 3 - 1);
    trail.positions.set(path);
    const marker = new Sprite(looks.probe);
    const hit = new Mesh(hitGeometry, looks.ghost);
    hit.userData.pick = { kind: "reach", id: probe.id } satisfies Selection;
    marker.position.fromArray(at);
    hit.position.fromArray(at);
    parent.add(trail.line, marker, hit);
    return { id: probe.id, at, r: Math.hypot(...at), trail, marker, hit };
  });

  const names = lod.fader();
  const lit = lod.fader();
  const toCamera = new Vector3();
  const facing = new Quaternion();
  const zAxis = new Vector3(0, 0, 1);
  const up = new Vector3();

  /* What a tap on a name opens: the heliopause, or the probe. */
  deps.picks.register((key): Selection | undefined => {
    if (key === "heliopause") return { kind: "reach", id: "heliopause" };
    const probe = probes.find((p) => p.id === key);
    return probe && { kind: "reach", id: probe.id };
  });

  return {
    pickables: probes.map((p) => p.hit),
    update({ show, sel, dist }: Frame) {
      const labelled = names.to(show.names);
      const lightTime = lit.to(show.lightTime);
      for (const ring of rings) {
        const shown = lightTime * ringShown(ring.au, dist);
        ring.line.visible = shown > 0.004;
        ring.material.opacity = RING_OPACITY * shown;
        /* Its name on the far side, along the line of sight. */
        toCamera.copy(camera.position).setY(0);
        const len = toCamera.length() || 1;
        place(
          ring.id,
          (-toCamera.x / len) * ring.au,
          0,
          (-toCamera.z / len) * ring.au,
          labelled * shown,
          BELOW,
        );
      }

      const bubbleOn = bubbleShown(dist);
      bubble.visible = bubbleOn > 0.004;
      looks.heliopause.opacity = bubbleOpacity * bubbleOn;
      const D = camera.position.length();
      limb.line.visible = bubble.visible && D > HELIOPAUSE_AU * 1.02;
      if (limb.line.visible) {
        /* Seen from D away, a sphere's outline is the circle r²/D toward us, of radius r·√(1 − r²/D²). */
        const k = HELIOPAUSE_AU / D;
        toCamera.copy(camera.position).normalize();
        facing.setFromUnitVectors(zAxis, toCamera);
        limb.line.quaternion.copy(facing);
        limb.line.position.copy(toCamera).multiplyScalar(HELIOPAUSE_AU * k);
        limb.line.scale.setScalar(HELIOPAUSE_AU * Math.sqrt(1 - k * k));
        limb.material.opacity = LIMB_OPACITY * bubbleOn;
        /* The name on the outline's top, as the screen has it. */
        up.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(limb.line.scale.x);
        up.add(limb.line.position);
        place("heliopause", up.x, up.y, up.z, labelled * bubbleOn);
      } else place("heliopause", 0, 0, 0, false);

      for (const p of probes) {
        const picked = sel?.kind === "reach" && sel.id === p.id;
        const shown = probeShown(p.r, dist);
        const on = shown > 0.004;
        p.marker.visible = p.trail.line.visible = p.hit.visible = on;
        const anchor = rulers.anchor(p.id);
        anchor.x = p.at[0];
        anchor.y = p.at[1];
        anchor.z = p.at[2];
        anchor.on = shown > 0.5;
        if (on) {
          p.marker.scale.setScalar(pxWorld(dist, picked ? 16 : 11) * shown);
          p.hit.scale.setScalar(pxWorld(dist, 14));
          p.trail.material.opacity = (picked ? 0.6 : TRAIL_OPACITY) * shown;
        }
        place(p.id, p.at[0], p.at[1], p.at[2], labelled * shown, PROBE_LABEL);
      }
    },
  };
}
