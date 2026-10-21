/**
 * α Centauri as three suns: A and B as discs of their measured size and colour, B on its
 * orbit about A, and Proxima a fifth of a light-year off, each with a glow, placed about the
 * ship as the solar bodies are, where a moving ship sees them and in the colour its motion
 * shifts their light to. From the solar system they are below a pixel and the sky's
 * catalogue point stands for them; parked at the system the discs take over.
 */
import {
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  Vector2,
  type BufferGeometry,
  type DataTexture,
  type Object3D,
} from "three";

import SURFACE_VERT from "@/space/solar-system/graphics/shaders/surface.vert.glsl";
import { smoothstep } from "@horizon/toolkit/math";
import {
  STRONG,
  pickLevel,
  spriteMaterial,
  vec3d,
  type PlaceLabel,
  type Vec3d,
} from "@horizon/toolkit/scene";
import { blackbodyColor, cssRgb } from "@horizon/toolkit/science";

import { LUT_RANGE_K } from "../graphics/looks";
import STAR_GLOBE_FRAG from "../graphics/shaders/star-globe.frag.glsl";
import {
  ALPHA_CENTAURI,
  alphaCentauriAt,
  type AlphaCentauriId,
  type AlphaCentauriStar,
} from "../model/alpha-centauri";
import type { Frame, VoyageKit } from "./kit";
import { placeSeen } from "./seen";

/** Globe levels by on-screen radius (CSS px), as the bodies'. */
const SPHERE_PX = [36, 360] as const;
/** Below this on-screen radius a disc is not drawn: the sky's point stands for the star. */
const DRAW_PX = 0.3;
/** A star's name reads once it is this large on screen (eased over the span). */
const NAME_PX = [1.5, 3] as const;
/** How far a star's glow reaches, in its radii (as the Sun's). */
const GLOW_RADII = 2.8;

/** The label key a star is named by: the pair's shared name for A, their own for the rest. */
const labelKey = (id: AlphaCentauriId) => (id === "alphaCenA" ? "alphaCen" : id);

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
  deps: { place: PlaceLabel },
) {
  const coarse = scope.own(new SphereGeometry(1, 24, 16));
  const fine = scope.own(new SphereGeometry(1, 72, 48));
  const close = scope.own(new SphereGeometry(1, 128, 80));
  const levels: BufferGeometry[] = [coarse, fine, close];
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
    const mesh = new Mesh(coarse, material);
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

  return {
    pickables: slots.map((slot) => slot.mesh),
    labelBodies: slots.map((slot) => ({ key: labelKey(slot.star.id), mesh: slot.mesh })),
    /** The three suns with their positions as drawn this frame, km (the scanner's blips). */
    positions: slots.map((slot) => ({
      id: slot.star.id as string,
      pos: slot.pos as Readonly<Vec3d>,
    })),
    /** How far a point (km, heliocentric) is from the nearest star's surface, km. */
    gap(at: ArrayLike<number>) {
      let best = Infinity;
      for (const { pos, star } of slots) {
        const d = Math.hypot(pos[0] - at[0]!, pos[1] - at[1]!, pos[2] - at[2]!) - star.radiusKm;
        if (d < best) best = d;
      }
      return best;
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
        const key = labelKey(star.id);
        if (!drawn) {
          deps.place(key, mesh.position.x, mesh.position.y, mesh.position.z, 0);
          continue;
        }
        const current = Math.max(0, levels.indexOf(mesh.geometry));
        mesh.geometry = levels[pickLevel(current, rPx, SPHERE_PX)]!;
        glow.position.copy(mesh.position);
        glow.scale.set(star.radiusKm * GLOW_RADII, star.radiusKm * GLOW_RADII, 1);
        const selected = sel?.kind === "star" && sel.id === mesh.userData.pick.id;
        const named =
          star.id === "alphaCenA" && aim === "alphaCen"
            ? 1
            : smoothstep(NAME_PX[0], NAME_PX[1], rPx);
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
