/**
 * α Centauri as three suns: A and B as discs of their measured size and colour, B on its
 * orbit about A, and Proxima a fifth of a light-year off, each with a glow, placed about the
 * ship as the solar bodies are, where a moving ship sees them and in the colour its motion
 * shifts their light to. From the solar system they are below a pixel and the sky's
 * catalogue point stands for them; parked at the system the discs take over.
 */
import { Mesh, ShaderMaterial, Sprite, Vector2, type DataTexture, type Object3D } from "three";

import SURFACE_VERT from "@/space/solar-system/graphics/shaders/surface.vert.glsl";
import { smoothstep } from "@horizon/toolkit/math";
import { STRONG, spriteMaterial, vec3d, type PlaceLabel, type Vec3d } from "@horizon/toolkit/scene";
import { blackbodyColor, cssRgb } from "@horizon/toolkit/science";

import { LUT_RANGE_K } from "../graphics/looks";
import STAR_GLOBE_FRAG from "../graphics/shaders/star-globe.frag.glsl";
import {
  ALPHA_CENTAURI,
  alphaCentauriAt,
  type AlphaCentauriId,
  type AlphaCentauriStar,
} from "../model/alpha-centauri";
import type { AnchorId } from "../model/anchors";
import { DRAW_PX, GLOW_RADII, NAME_PX, type Globes } from "./globes";
import type { Frame, VoyageKit } from "./kit";
import { placeSeen } from "./seen";

/** The anchor, and the label key, a star is named by: the pair's shared name for A. */
const anchorOf = (id: AlphaCentauriId): AnchorId => (id === "alphaCenA" ? "alphaCen" : id);

type Slot = {
  star: AlphaCentauriStar;
  mesh: Mesh;
  material: ShaderMaterial;
  glow: Sprite;
  pos: Vec3d;
};

export function createAlphaCentauriLayer(
  { scope, lod, looks }: VoyageKit,
  parent: Object3D,
  lut: DataTexture,
  deps: { place: PlaceLabel; globes: Globes },
) {
  const { globes } = deps;
  /* The Sun's own halo, tinted per star. */
  const halo = looks.sunGlow.map!;

  const slots: Slot[] = ALPHA_CENTAURI.map((star) => {
    const material = scope.own(
      new ShaderMaterial({
        uniforms: {
          kelvin: { value: star.kelvin },
          bbLut: { value: lut },
          lutRange: { value: new Vector2(LUT_RANGE_K[0], LUT_RANGE_K[1]) },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: STAR_GLOBE_FRAG,
      }),
    );
    const mesh = new Mesh(globes.coarse, material);
    mesh.userData.pick = { kind: "star", id: star.id === "proxima" ? "proxima" : "alphaCen" };
    mesh.userData.globe = mesh;
    mesh.visible = false;
    const glow = new Sprite(
      scope.own(spriteMaterial(halo, cssRgb(blackbodyColor(star.kelvin)), 1, true)),
    );
    glow.visible = false;
    parent.add(mesh, glow);
    return { star, mesh, material, glow, pos: vec3d() };
  });
  const names = lod.fader();
  const nearest = { id: "alphaCen" as AnchorId, gap: Infinity };

  return {
    pickables: slots.map((slot) => slot.mesh),
    labelBodies: slots.map((slot) => ({ key: anchorOf(slot.star.id), mesh: slot.mesh })),
    /** The three suns with their positions as drawn this frame, km (the scanner's blips). */
    positions: slots.map((slot) => ({
      id: slot.star.id as string,
      pos: slot.pos as Readonly<Vec3d>,
    })),
    /** The star whose surface is nearest a point (km, heliocentric), and how far it is (a reused object). */
    nearest(at: ArrayLike<number>) {
      nearest.gap = Infinity;
      for (const { pos, star } of slots) {
        const gap = Math.hypot(pos[0] - at[0]!, pos[1] - at[1]!, pos[2] - at[2]!) - star.radiusKm;
        if (gap < nearest.gap) {
          nearest.gap = gap;
          nearest.id = anchorOf(star.id);
        }
      }
      return nearest;
    },
    update({ now, show, sel, ship, aim, motion }: Frame) {
      const labelled = names.to(show.names);
      for (const slot of slots) {
        const { star, mesh, material, glow, pos } = slot;
        alphaCentauriAt(star.id, now, pos);
        const D = placeSeen(mesh, pos, ship, motion);
        material.uniforms.kelvin!.value = star.kelvin * D;
        mesh.scale.setScalar(star.radiusKm);
        const rPx = lod.px(star.radiusKm, mesh.position);
        const drawn = rPx >= DRAW_PX;
        mesh.visible = glow.visible = drawn;
        const key = anchorOf(star.id);
        if (!drawn) {
          deps.place(key, mesh.position.x, mesh.position.y, mesh.position.z, 0);
          continue;
        }
        globes.fit(mesh, rPx);
        glow.position.copy(mesh.position);
        glow.scale.set(star.radiusKm * GLOW_RADII, star.radiusKm * GLOW_RADII, 1);
        const selected = sel?.kind === "star" && sel.id === mesh.userData.pick.id;
        const named = key === aim ? 1 : smoothstep(NAME_PX[0], NAME_PX[1], rPx);
        deps.place(
          key,
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
          labelled * named,
          selected ? STRONG : undefined,
        );
      }
    },
  };
}
