/** Nearest stars in their real directions, on straight-line tracks, and the nearest-star ring. */
import { Mesh, SphereGeometry, Sprite, TorusGeometry, Vector3, type Object3D } from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import {
  NEIGHBOURS,
  NEIGHBOUR_WINDOW,
  nearestNeighbour,
  neighbourPosition,
  type NeighbourId,
} from "../model/neighbours";
import type { Selection } from "../store";
import { ownedLine } from "./geometry";
import type { Frame, Labels, SceneKit } from "./kit";
import { BELOW, type PlaceLabel } from "./labels";
import { fade, rising } from "./lod";
import type { DistanceText, Rulers } from "./rulers";

const PROXIMA_AU = 4.2465 * LIGHT_YEAR_AU;
const track: Vec3 = [0, 0, 0];
/** Where the nearest stars read (camera distance, au): from the Oort cloud into the handoff. */
const STARS = fade(14_000, 28_000, 1_200_000, 4_000_000);
const RING = fade(45_000, 80_000, 600_000, 1_100_000);
const RING_NAME = fade(60_000, 100_000, 500_000, 900_000);

export function createNeighboursLayer(
  { scope, looks, pxWorld, lod }: SceneKit,
  parent: Object3D,
  deps: { place: PlaceLabel; rulers: Rulers; labels: Labels; distanceText: DistanceText },
) {
  const { place, rulers, labels, distanceText } = deps;
  const ring = new Mesh(scope.own(new TorusGeometry(PROXIMA_AU, 1_800, 8, 80)), looks.proxima);
  ring.rotation.x = Math.PI / 2;
  ring.userData.pick = { kind: "star", id: "proxima" } satisfies Selection;
  parent.add(ring);

  const ringOpacity = looks.proxima.opacity;
  const sphere = scope.own(new SphereGeometry(1, 12, 10));
  const stars = NEIGHBOURS.map((star) => {
    const material = scope.own(looks.neighbour(star.color));
    const glowMaterial = scope.own(looks.neighbourGlow(star.color));
    const glow = new Sprite(glowMaterial);
    const mesh = new Mesh(sphere, material);
    mesh.add(glow);
    mesh.userData.pick = { kind: "star", id: star.id } satisfies Selection;
    const beam = ownedLine(scope, 0x9ebccc, 0.3, 1);
    parent.add(mesh, beam.line);
    return { star, mesh, glow, glowOpacity: glowMaterial.opacity, beam };
  });
  const vec = new Vector3();
  const era = lod.fader();
  const names = lod.fader();
  /* The ring's label names the nearest star of the moment. */
  let ringStar: NeighbourId = "proxima";

  return {
    pickables: [ring, ...stars.map((n) => n.mesh)],
    /** What a tap on a label opens. */
    labelPick: (key: string): Selection | undefined => {
      const id = key === "proximaRing" ? ringStar : NEIGHBOURS.find((n) => n.id === key)?.id;
      return id && { kind: "star", id };
    },
    /** `azimuth` turns the ring's label toward the camera. */
    update({ show, yearsAgo, dist }: Frame, azimuth: number) {
      const nearby = era.to(yearsAgo < NEIGHBOUR_WINDOW);
      const labelled = names.to(show.names);
      const shown = nearby * STARS(dist);
      const nearest = shown > 0 ? nearestNeighbour(Math.min(yearsAgo, NEIGHBOUR_WINDOW)) : null;
      const ringShown = nearest ? nearby * RING(dist) : 0;
      ring.visible = ringShown > 0.004;
      looks.proxima.opacity = ringOpacity * ringShown;
      if (nearest) ring.scale.setScalar((nearest.ly * LIGHT_YEAR_AU) / PROXIMA_AU);
      const ringLabel = nearest
        ? `${labels()[nearest.star.id] ?? nearest.star.id} · ${distanceText(nearest.ly * LIGHT_YEAR_AU, true)}`
        : undefined;
      const ringR = nearest ? nearest.ly * LIGHT_YEAR_AU : PROXIMA_AU;
      if (nearest) ringStar = nearest.star.id;
      place(
        "proximaRing",
        -Math.sin(azimuth) * ringR,
        0,
        -Math.cos(azimuth) * ringR,
        labelled * nearby * RING_NAME(dist) * (ring.visible ? 1 : 0),
        ringLabel !== undefined ? { text: ringLabel } : {},
      );
      for (const n of stars) {
        const p = vec.fromArray(neighbourPosition(n.star, yearsAgo, track));
        const far = p.length();
        /* Stars far past the frame would sit behind the camera's shoulder. */
        const presence = shown * (1 - rising(far / dist, 2.2, 3));
        const on = presence > 0.004;
        n.mesh.visible = on;
        n.beam.line.visible = on && n.star.id === nearest?.star.id && !show.distances;
        const anchor = rulers.anchor(n.star.id);
        anchor.x = p.x;
        anchor.y = p.y;
        anchor.z = p.z;
        anchor.on = presence > 0.5;
        if (on) {
          n.mesh.position.copy(p);
          const r = pxWorld(dist, 3.2 * n.star.weight) * presence;
          n.mesh.scale.setScalar(r);
          /* The halo is 26 px to the star's 3.2, relative to its parent. */
          n.glow.scale.set(26 / 3.2, 26 / 3.2, 1);
          n.glow.material.opacity = n.glowOpacity * presence;
          if (n.beam.line.visible) {
            n.beam.material.opacity = 0.3 * presence;
            n.beam.positions.set([0, 0, 0, p.x, p.y, p.z]);
            n.beam.geometry.getAttribute("position").needsUpdate = true;
          }
        }
        const style = n.star.id === "proxima" ? BELOW : undefined;
        place(
          n.star.id,
          p.x,
          p.y,
          p.z,
          labelled * presence * rising(far / dist, 0.035, 0.06),
          style,
        );
      }
    },
  };
}
