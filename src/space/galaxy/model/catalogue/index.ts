/**
 * Every figure the Galaxy's and the nearest stars' cards print, once: value or published span,
 * a unit of the science kit, a source and how it was checked. Values the model computes with
 * stay in the model (`parameters.ts`, `neighbours.ts`) and are referenced here, not copied.
 * docs/science-sources.md lists the catalogue (`npm run docs:catalogue`).
 */
import { factsOf } from "@/lib/facts";

import { GALAXY } from "./galaxy";
import { STARS } from "./stars";

export const GALAXY_CATALOGUE = { galaxy: GALAXY, stars: STARS } as const;

/** Every fact with its path ("galaxy.sun.lap", "stars.proxima.distance"), for tests and the ledger. */
export const galaxyCatalogueFacts = () => factsOf(GALAXY_CATALOGUE);
