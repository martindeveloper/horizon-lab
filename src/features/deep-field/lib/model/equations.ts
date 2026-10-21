/**
 * Every formula Deep Field's `technical.json` may reference by ID: the toolkit's laws, the
 * solar system's, the Galaxy's (`@/space/galaxy/model/equations`) and the cosmic map's. Each is
 * written once where its model computes with it; tests check them there.
 */
import { localGroupOrbit } from "@/space/cosmos/model/cosmos";
import {
  galacticHeight,
  galacticRadius,
  galacticWarp,
  spiralArm,
} from "@/space/galaxy/model/equations";
import { galacticAngle } from "@/space/solar-system/model/equations";
import {
  keplerThirdLaw,
  lightTravelTime,
  tangentialVelocity,
  type Formula,
} from "@horizon/toolkit/science";

export const DEEP_FIELD_EQUATIONS = Object.fromEntries<Formula>(
  [
    keplerThirdLaw,
    lightTravelTime,
    tangentialVelocity,
    galacticAngle,
    galacticRadius,
    galacticHeight,
    spiralArm,
    localGroupOrbit,
    galacticWarp,
  ].map((equation) => [equation.id, equation]),
);
