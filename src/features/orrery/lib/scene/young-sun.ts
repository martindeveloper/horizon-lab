/**
 * The faint young Sun in the scene (model/young-sun.ts): the Sun's glow follows its output on
 * the timeline, and the habitable zone is a band in the ecliptic that moves in as the Sun
 * dims, with its name on it. Drawn only where the law is applied and at the inner scale.
 */
import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, type Object3D } from "three";

import type { ShownFor, SolarFrame, SolarKit } from "@/space/solar-system/scene/kit";
import { HABITABLE_ZONE_AU } from "@/space/sun/model/young-sun";
import { BELOW, framed, ownedLine, type PlaceLabel } from "@horizon/toolkit/scene";

import { habitableZone, sunLuminosity, youngSunModelled } from "../model/young-sun";

/** A soft green: the band reads as a zone, not an orbit. */
const ZONE_COLOR = 0x79c7a3;
const FILL_OPACITY = 0.09;
const EDGE_OPACITY = 0.4;
const SEG = 128;

export type YoungSun = ReturnType<typeof createYoungSun>;

export function createYoungSun(
  kit: SolarKit,
  parent: Object3D,
  deps: { place: PlaceLabel; shownFor: ShownFor },
) {
  const { scope, looks, lod } = kit;
  const [inner, outer] = HABITABLE_ZONE_AU;
  /* Today's band; a moment scales it by the square root of the Sun's output. */
  const zone = new Group();
  const fill = new Mesh(
    scope.own(new RingGeometry(inner, outer, SEG, 1)),
    scope.own(
      new MeshBasicMaterial({
        color: ZONE_COLOR,
        transparent: true,
        opacity: FILL_OPACITY,
        depthWrite: false,
        side: DoubleSide,
      }),
    ),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.userData.annotation = true;
  zone.add(fill);
  const edges = [inner, outer].map((radius) => {
    const edge = ownedLine(scope, ZONE_COLOR, EDGE_OPACITY, SEG);
    for (let k = 0; k <= SEG; k += 1) {
      const angle = (k / SEG) * Math.PI * 2;
      edge.positions[k * 3] = radius * Math.cos(angle);
      edge.positions[k * 3 + 2] = radius * Math.sin(angle);
    }
    zone.add(edge.line);
    return edge;
  });
  zone.visible = false;
  parent.add(zone);
  const glow = looks.sunGlow;
  const glowOpacity = glow.opacity;
  const names = lod.fader();

  return {
    /** Draws a frame: the glow at the moment's output, the band where the law is applied and `on`. */
    update({ yearsAgo, dist, show }: SolarFrame, on: boolean) {
      const luminosity = sunLuminosity(yearsAgo);
      glow.opacity = glowOpacity * luminosity;
      const { inner: near, outer: far } = habitableZone(yearsAgo);
      const shown =
        on && youngSunModelled(yearsAgo) ? framed(near, far, dist) * deps.shownFor("sun") : 0;
      zone.visible = shown > 0.004;
      const labelled = names.to(show.names);
      deps.place("habitableZone", 0, 0, far, labelled * shown, BELOW);
      if (!zone.visible) return;
      zone.scale.setScalar(Math.sqrt(luminosity));
      fill.material.opacity = FILL_OPACITY * shown;
      for (const edge of edges) edge.material.opacity = EDGE_OPACITY * shown;
    },
  };
}
