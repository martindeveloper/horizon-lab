/** The nearest stars in their real directions and distances today, and Proxima's ring. */
import { Mesh, SphereGeometry, Sprite, TorusGeometry, Vector3, type Object3D } from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import {
  BELOW,
  fade,
  ownedLine,
  rising,
  type AnchoredRulers,
  type DistanceText,
  type LabelText,
  type PlaceLabel,
} from "@horizon/toolkit/scene";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { NEIGHBOURS, neighbourDistanceLy, neighbourPosition } from "../model/neighbours";
import type { Selection } from "../store";
import type { Frame, SceneKit } from "./kit";
import type { LabelPicks } from "./label-picks";

const PROXIMA = NEIGHBOURS[0]!;
const PROXIMA_AU = neighbourDistanceLy(PROXIMA, 0) * LIGHT_YEAR_AU;
/** Where the nearest stars read (camera distance, au): round the Sun, into the handoff. */
const STARS = fade(0, 0, 1_200_000, 4_000_000);
const RING = fade(0, 0, 600_000, 1_100_000);
const RING_NAME = fade(0, 0, 500_000, 900_000);

export function createNeighboursLayer(
  { scope, looks, pxWorld, lod }: SceneKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    rulers: AnchoredRulers;
    labels: LabelText;
    distanceText: DistanceText;
    picks: LabelPicks;
  },
) {
  const { place, rulers, labels, distanceText } = deps;
  const ring = new Mesh(scope.own(new TorusGeometry(PROXIMA_AU, 1_800, 8, 80)), looks.proxima);
  ring.rotation.x = Math.PI / 2;
  ring.userData.pick = { kind: "star", id: "proxima" } satisfies Selection;
  parent.add(ring);

  const ringOpacity = looks.proxima.opacity;
  const sphere = scope.own(new SphereGeometry(1, 12, 10));
  const track: Vec3 = [0, 0, 0];
  const stars = NEIGHBOURS.map((star) => {
    const material = scope.own(looks.neighbour(star.color));
    const glowMaterial = scope.own(looks.neighbourGlow(star.color));
    const glow = new Sprite(glowMaterial);
    const mesh = new Mesh(sphere, material);
    mesh.add(glow);
    mesh.userData.pick = { kind: "star", id: star.id } satisfies Selection;
    mesh.position.fromArray(neighbourPosition(star, 0, track));
    const beam = ownedLine(scope, 0x9ebccc, 0.3, 1);
    beam.positions.set([0, 0, 0, mesh.position.x, mesh.position.y, mesh.position.z]);
    parent.add(mesh, beam.line);
    return { star, mesh, glow, glowOpacity: glowMaterial.opacity, beam };
  });
  const names = lod.fader();
  const vec = new Vector3();

  /* What a tap on a name opens: the star, or Proxima for its ring. */
  deps.picks.register((key): Selection | undefined => {
    const id = key === "proximaRing" ? PROXIMA.id : NEIGHBOURS.find((n) => n.id === key)?.id;
    return id && { kind: "star", id };
  });

  return {
    pickables: [ring, ...stars.map((n) => n.mesh)],
    /** `azimuth` turns the ring's label toward the camera. */
    update({ show, dist }: Frame, azimuth: number) {
      const labelled = names.to(show.names);
      const shown = STARS(dist);
      const ringShown = RING(dist);
      ring.visible = ringShown > 0.004;
      looks.proxima.opacity = ringOpacity * ringShown;
      const L = labels();
      place(
        "proximaRing",
        -Math.sin(azimuth) * PROXIMA_AU,
        0,
        -Math.cos(azimuth) * PROXIMA_AU,
        labelled * RING_NAME(dist) * (ring.visible ? 1 : 0),
        { text: `${L.proxima ?? "Proxima"} · ${distanceText(PROXIMA_AU, true)}` },
      );
      for (const n of stars) {
        const p = vec.copy(n.mesh.position);
        const far = p.length();
        /* Stars far past the frame would sit behind the camera's shoulder. */
        const presence = shown * (1 - rising(far / dist, 2.2, 3));
        const on = presence > 0.004;
        n.mesh.visible = on;
        n.beam.line.visible = on && n.star.id === PROXIMA.id && !show.distances;
        const anchor = rulers.anchor(n.star.id);
        anchor.x = p.x;
        anchor.y = p.y;
        anchor.z = p.z;
        anchor.on = presence > 0.5;
        if (on) {
          const r = pxWorld(dist, 3.2 * n.star.weight) * presence;
          n.mesh.scale.setScalar(r);
          /* The halo is 26 px to the star's 3.2, relative to its parent. */
          n.glow.scale.set(26 / 3.2, 26 / 3.2, 1);
          n.glow.material.opacity = n.glowOpacity * presence;
          if (n.beam.line.visible) n.beam.material.opacity = 0.3 * presence;
        }
        const style = n.star.id === PROXIMA.id ? BELOW : undefined;
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
