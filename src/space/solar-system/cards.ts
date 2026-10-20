/**
 * The figures the solar system's population cards quote, by the row each fills: the belt and
 * cloud regions, their masses, what is catalogued. Both simulations print them, each in its own
 * words (the Orrery through its card messages, Deep Field as bare figures with light-times).
 */
import { r, v, type Ref } from "@/lib/facts";

import { SOLAR_CATALOGUE } from "./model/catalogue";

const P = SOLAR_CATALOGUE.populations;

export const POPULATION_FIGURES = {
  asteroids: { where: r(P.asteroids.where), mass: v(P.asteroids.mass) },
  disk: { drawnAt: r(P.disk.drawnAt), mass: v(P.disk.mass) },
  kuiper: {
    region: r(P.kuiper.region),
    todayMass: v(P.kuiper.todayMass),
    originalMass: v(P.kuiper.originalMass),
    catalogued: v(P.kuiper.catalogued),
    cliff: v(P.kuiper.cliff),
    cold: r(P.kuiper.coldClassicals),
    plutinos: v(P.kuiper.plutinos),
  },
  oort: {
    innerEdge: r(P.oort.innerEdge),
    outerEdge: r(P.oort.outerEdge),
    innerShell: v(P.oort.innerShell),
    outerShell: v(P.oort.outerShell),
  },
} satisfies Record<string, Record<string, Ref>>;
