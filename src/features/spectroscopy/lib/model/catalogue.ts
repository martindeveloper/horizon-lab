/**
 * Every figure Stellar Spectra's guide, views and technical notes quote, by the placeholder
 * their messages use: the shared catalogue's stars (`@/space/stellar`) and the lab's own range.
 * Figures print as numbers in the unit the prose names ("{arcturusK} K"); spectral types as
 * catalogued.
 */
import { factsOf, proseFacts, quoteAs, type ProseFigure } from "@/lib/facts";
import { NAMED_STARS, SPECTRAL_TYPES } from "@/space/stellar";

import { SEQUENCE_RANGE } from "./atmospheres";
import { STAR_IDS, STARS, type StarId } from "./stars";

export const PROSE_FIGURES = {
  arcturusK: quoteAs(NAMED_STARS.arcturus.teff, { digits: 2 }),
  sequenceFromK: {
    value: SEQUENCE_RANGE[0],
    unit: "K",
    source: "horizon",
    status: "teaching-choice",
    note: "the coolest main-sequence star drawn: below it molecules the lab leaves out take over",
  },
  sequenceToK: {
    value: SEQUENCE_RANGE[1],
    unit: "K",
    source: "horizon",
    status: "teaching-choice",
    note: "the hottest main-sequence star drawn: the model grid's hot end",
  },
} satisfies Record<string, ProseFigure>;

/** A star's spectral class and subclass, without its luminosity class: "O9.5" of "O9.5 Iab". */
const classOf = (id: StarId) => SPECTRAL_TYPES[id]?.split(" ")[0] ?? "";

const byTemperature = [...STAR_IDS].sort((a, b) => STARS[b].teff.kelvin - STARS[a].teff.kelvin);

/** The words the prose quotes as catalogued, by placeholder: the Sun's type, the drawn stars' span. */
export const PROSE_TYPES = {
  sunType: SPECTRAL_TYPES.sun ?? "",
  hottestType: classOf(byTemperature[0]!),
  coolestType: classOf(byTemperature.at(-1)!),
};

/** Every figure, for tests. */
export const catalogueFacts = () => factsOf({ spectroscopy: { prose: proseFacts(PROSE_FIGURES) } });
