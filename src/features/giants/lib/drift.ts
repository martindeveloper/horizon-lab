import type { CuedShot, DriftProgramme } from "@/lib/drift";

/**
 * Giants' drift: one climb up the ladder that never turns back, timed to "Vast Empty Space"
 * (261.5 s, looping every 253.5 s after the player's 8 s crossfade). The track is a level,
 * pulsing bed: a hush at 14 s, a swell at 24 s, its brightest moment at 82 s, a dip and surge
 * at 153 s into its peak at 163 s, and a last breath at 229 s. The climb meets it by the
 * track's map: from a pulsar to the Sun landing on the swell, R136a1, the heaviest star, on the
 * brightest moment; the one push-in, the surface zoom onto Betelgeuse, begins on the surge and
 * arrives on the peak; the zoom eases out and the climb carries on past the largest stars to
 * TON 618's horizon, landing on the last breath, the planets' orbits drawn inside it. The other
 * rungs are flown through. Each hold creeps up through its body (`creep`, rungs either side,
 * within `WEATHER_NEAR` so its star stays alive), sliding it across the frame. A climb cannot
 * fly back down: the scene fades through black on the loop's seam (`fade`) and the first shot
 * comes out of it at its body (`model/drift-path.ts`). The holds written here are the timing
 * without a map and add up to the period; `timeShots` sets them so the cued shots meet their cues.
 */
import type { RungId } from "./model/rungs";

export type GiantsDriftShot = CuedShot & {
  /** The body the shot holds at. */
  rung: RungId;
  /** Where the hold begins and ends, rungs from the body, the second higher up the ladder. */
  creep: readonly [number, number];
  /** The surface zoom held, as the View panel's (1 by default). */
  zoom?: number;
  /** The planets' orbits round the body. */
  orbits?: boolean;
  flight: { duration: number };
  hold: number;
};

export const DRIFT: DriftProgramme<GiantsDriftShot> = {
  music: { track: "Vast Empty Space", period: 253.5 },
  camera: { flight: 12, hold: 12 },
  fade: 3,
  shots: [
    /* A pulsar's beams in the opening hush, out of the black. */
    { at: "start", rung: "neutron-star", creep: [0, 0.12], flight: { duration: 3 }, hold: 5 },
    /* Past the dead and the small (Sirius B, Earth, Jupiter, the red dwarfs) to the Sun on the swell. */
    { land: "swell", rung: "sun", creep: [-0.12, 0.12], flight: { duration: 16 }, hold: 26 },
    { rung: "achernar", creep: [-0.1, 0.1], flight: { duration: 12 }, hold: 8 },
    /* Past Sagittarius A*'s lensing to the heaviest star on the brightest moment. */
    { land: "bright-2", rung: "r136a1", creep: [-0.12, 0.12], flight: { duration: 12 }, hold: 14 },
    { rung: "rigel", creep: [-0.12, 0.12], flight: { duration: 12 }, hold: 14 },
    /* Past Deneb and Antares: Betelgeuse whole, its plumes waking. */
    { rung: "betelgeuse", creep: [-0.12, -0.06], flight: { duration: 24 }, hold: 7 },
    /* The one push-in: onto its face on the surge, close by the peak. */
    {
      at: "surge",
      rung: "betelgeuse",
      creep: [-0.04, 0.08],
      zoom: 2,
      flight: { duration: 10 },
      hold: 28,
    },
    /* The release: the zoom eases out about Betelgeuse before the climb leaves it. */
    { rung: "betelgeuse", creep: [0.1, 0.12], flight: { duration: 8 }, hold: 2 },
    /* Past UY Scuti, VY Canis Majoris, Stephenson 2-18 and M87* to TON 618 on the last breath. */
    {
      land: "breath-2",
      rung: "ton-618",
      creep: [-0.12, 0],
      orbits: true,
      flight: { duration: 28 },
      hold: 24.5,
    },
  ],
};
