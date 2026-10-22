import { SOLAR_EQUATIONS } from "@/space/solar-system/model/equations";
import { OBSERVATORY_EQUATIONS } from "@/space/solar-system/model/observatories";
import { ORBIT_EQUATIONS } from "@horizon/toolkit/bodies";
import { keplerThirdLaw, lightTravelTime, type Formula } from "@horizon/toolkit/science";

/**
 * Every formula the Orrery's `technical.json` may reference by ID: the shared laws and the
 * solar system model's own. Shader-only steps, vector rotations and sampling recipes stay as
 * text in `technical.json`.
 */
export const ORRERY_EQUATIONS = Object.fromEntries<Formula>(
  [
    keplerThirdLaw,
    lightTravelTime,
    ...ORBIT_EQUATIONS,
    ...SOLAR_EQUATIONS,
    ...OBSERVATORY_EQUATIONS,
  ].map((equation) => [equation.id, equation]),
);
