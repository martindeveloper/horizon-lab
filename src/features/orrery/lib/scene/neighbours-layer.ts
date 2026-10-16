/** Nearest stars in their real directions, on straight-line tracks, and the nearest-star ring. */
import { Mesh, SphereGeometry, Sprite, TorusGeometry, Vector3, type Object3D } from "three";

import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import {
  NEIGHBOURS,
  NEIGHBOUR_WINDOW,
  nearestNeighbour,
  neighbourPosition,
} from "../model/neighbours";
import type { Selection } from "../store";
import { ownedLine } from "./geometry";
import type { Frame, Labels, SceneKit } from "./kit";
import { BELOW, type PlaceLabel } from "./labels";
import type { DistanceText, Rulers } from "./rulers";

const PROXIMA_AU = 4.2465 * LIGHT_YEAR_AU;

export function createNeighboursLayer(
  { scope, looks, pxWorld }: SceneKit,
  parent: Object3D,
  deps: { place: PlaceLabel; rulers: Rulers; labels: Labels; distanceText: DistanceText },
) {
  const { place, rulers, labels, distanceText } = deps;
  const ring = new Mesh(scope.own(new TorusGeometry(PROXIMA_AU, 1_800, 8, 80)), looks.proxima);
  ring.rotation.x = Math.PI / 2;
  ring.userData.pick = { kind: "star", id: "proxima" } satisfies Selection;
  parent.add(ring);

  const sphere = scope.own(new SphereGeometry(1, 12, 10));
  const stars = NEIGHBOURS.map((star) => {
    const material = scope.own(looks.neighbour(star.color));
    const glow = new Sprite(scope.own(looks.neighbourGlow(star.color)));
    const mesh = new Mesh(sphere, material);
    mesh.add(glow);
    mesh.userData.pick = { kind: "star", id: star.id } satisfies Selection;
    const beam = ownedLine(scope, 0x9ebccc, 0.3, 1);
    parent.add(mesh, beam.line);
    return { star, mesh, glow, beam };
  });
  const vec = new Vector3();

  return {
    pickables: [ring, ...stars.map((n) => n.mesh)],
    /** `azimuth` turns the ring's label toward the camera. */
    update({ show, yearsAgo, dist }: Frame, azimuth: number) {
      const nearby = yearsAgo < NEIGHBOUR_WINDOW && dist > 20_000;
      const nearest = nearby ? nearestNeighbour(yearsAgo) : null;
      ring.visible = nearby && dist > 60_000 && dist < 800_000;
      if (nearest) ring.scale.setScalar((nearest.ly * LIGHT_YEAR_AU) / PROXIMA_AU);
      const ringLabel = nearest
        ? `${labels()[nearest.star.id] ?? nearest.star.id} · ${distanceText(nearest.ly * LIGHT_YEAR_AU, true)}`
        : undefined;
      const ringR = nearest ? nearest.ly * LIGHT_YEAR_AU : PROXIMA_AU;
      place(
        "proximaRing",
        -Math.sin(azimuth) * ringR,
        0,
        -Math.cos(azimuth) * ringR,
        show.names && ring.visible && dist > 80_000 && dist < 700_000,
        ringLabel !== undefined ? { text: ringLabel } : {},
      );
      for (const n of stars) {
        const p = neighbourPosition(n.star, yearsAgo, vec);
        const far = p.length();
        const on = nearby && far < dist * 2.4 && dist > 20_000 && dist < 900_000;
        n.mesh.visible = on;
        n.beam.line.visible = on && n.star.id === nearest?.star.id && !show.distances;
        const anchor = rulers.anchor(n.star.id);
        anchor.x = p.x;
        anchor.y = p.y;
        anchor.z = p.z;
        anchor.on = on;
        if (on) {
          n.mesh.position.copy(p);
          const r = pxWorld(dist, 3.2 * n.star.weight);
          n.mesh.scale.setScalar(r);
          const g = pxWorld(dist, 26 * n.star.weight) / r;
          n.glow.scale.set(g, g, 1);
          if (n.beam.line.visible) {
            n.beam.positions.set([0, 0, 0, p.x, p.y, p.z]);
            n.beam.geometry.getAttribute("position").needsUpdate = true;
          }
        }
        const style = n.star.id === "proxima" ? BELOW : undefined;
        place(n.star.id, p.x, p.y, p.z, show.names && on && far > dist * 0.05, style);
      }
    },
  };
}
