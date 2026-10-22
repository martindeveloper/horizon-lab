import type { WebGLRenderer } from "three";

import { createSpacecraftPass, type Craft } from "@/space/spacecraft/scene/spacecraft-pass";
/**
 * The five probes at their true size (`@/space/spacecraft`), for any host of the solar
 * system: each where its track has it, its dish turned to Earth and lit by the Sun. Far off
 * they are the reach's markers; as the camera closes on one, its model loads and takes over.
 */
import type { Vec3 } from "@horizon/toolkit/bodies";
import type { SceneHostBasics } from "@horizon/toolkit/scene";

import { PROBES, PROBE_SPACECRAFT, type ProbeId } from "../model/probes";
import type { ReachFrame } from "./reach-layer";

/** Where things are this frame, heliocentric, in the host's units. */
export type ProbeCraftsFrame = {
  dt: number;
  /** Writes a probe's position into `out`. */
  probeAt: (id: ProbeId, out: Vec3) => Vec3;
  earth: Readonly<Vec3>;
  /**
   * The camera, as a point the host holds exactly (a ship, an orbit's aim) and its offset from
   * there: a probe is placed from the camera by both, never by a rounded camera position.
   */
  base: Readonly<Vec3>;
  offset: Readonly<Vec3>;
  /** The probe the camera is closing on. */
  approach: ProbeId | null;
};

export function createProbeCrafts(
  basics: SceneHostBasics,
  options: { unitM: number; invalidate: () => void },
) {
  const pass = createSpacecraftPass(basics, options);
  const crafts = PROBES.map((probe): Craft & { key: ProbeId } => ({
    key: probe.id,
    model: PROBE_SPACECRAFT[probe.id],
    at: [0, 0, 0],
    facing: [0, 0, 0],
  }));
  const sun: Vec3 = [0, 0, 0];

  return {
    /** Places the probes; returns the one the camera closes on and how far its model has taken over, for the reach. */
    update({
      dt,
      probeAt,
      earth,
      base,
      offset,
      approach,
    }: ProbeCraftsFrame): ReachFrame["approach"] {
      const fromCamera = (k: number, v: number) => v - base[k]! - offset[k]!;
      for (const craft of crafts) {
        probeAt(craft.key, craft.at);
        for (let k = 0; k < 3; k++) {
          craft.at[k] = fromCamera(k, craft.at[k]!);
          craft.facing[k] = fromCamera(k, earth[k]!);
        }
      }
      for (let k = 0; k < 3; k++) sun[k] = fromCamera(k, 0);
      pass.update({ dt, sun, crafts, approach });
      return approach && { id: approach, model: pass.presence(approach) };
    },
    render: (renderer: WebGLRenderer) => pass.render(renderer),
    /** A probe is big enough on screen to show, and its model is still on its way. */
    get waiting() {
      return pass.waiting;
    },
  };
}
