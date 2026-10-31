import { GRANULE_SCALE_HEIGHTS } from "@/space/sun/model/granulation";
import { formatNumber } from "@horizon/toolkit/science";
import { SOURCE_URLS } from "@horizon/toolkit/urls";

import {
  DAY_CEILING,
  DAY_FLOOR,
  DAY_GAMMA,
  DAY_TODAY,
  DISC_PEAK,
  FOV_DEG,
  ORBIT_RADII,
  STARS_OUT,
} from "./lib/model/parameters";

const specification = {
  schemaVersion: 1,
  features: ["track", "worlds", "sky", "clock"],
  sections: [
    {
      id: "track",
      equations: [
        { equation: "stellar-radius" },
        { equation: "stefan-boltzmann" },
        { equation: "young-sun-luminosity" },
        "log L, log T linear in age between rows; in log(t − t_AGB + 100 yr) after the envelope leaves",
      ],
    },
    {
      id: "worlds",
      equations: [
        { equation: "orbit-widening" },
        { equation: "orbital-period" },
        { equation: "habitable-zone-edge" },
        { equation: "sunlight-share" },
        { equation: "angular-size" },
      ],
    },
    {
      id: "sky",
      equations: [
        { equation: "planck-law" },
        { equation: "wien-displacement" },
        `camera ${ORBIT_RADII} R from the world's centre: the limb dips acos(1/${ORBIT_RADII}) below the level`,
        "I(μ)/I(1) = 1 − Σₖ aₖ (1 − μ^(k/2)),  k = 1…4 (Claret; (2 + 3μ)/5 for the dwarf)",
        `N ≈ R / (${formatNumber(GRANULE_SCALE_HEIGHTS, "en", 2)} H) cells across the radius, H the photosphere's pressure scale height`,
        `shown = E · (I/I⊕)^${DAY_GAMMA},  E = clamp(${DAY_TODAY}, ${DAY_FLOOR} / S^${DAY_GAMMA}, ${DAY_CEILING} / S^${DAY_GAMMA}) eased in log to the disc's own as (R/${FOV_DEG.open / 2}°)² fills the view; S the day side's light, I any radiance against a white surface at 1 au today`,
        `the disc's brightest channel shown at most ${DISC_PEAK}, past the day side's ${DAY_CEILING}`,
        `stars out as the field (the day side, or a disc that fills the view) rises from ${STARS_OUT.floor} to ${STARS_OUT.ceiling}`,
      ],
    },
    {
      id: "clock",
      equations: [
        "dt_sun / dt = (t_until − t_from) / s_chapter × pace × tempo(u); log in the fade",
      ],
    },
  ],
  references: [
    {
      title:
        "Schröder & Smith (2008), Distant future of the Sun and Earth revisited, MNRAS 386, 155",
      url: "https://doi.org/10.1111/j.1365-2966.2008.13022.x",
    },
    {
      title: "Sackmann, Boothroyd & Kraemer (1993), Our Sun. III. Present and future, ApJ 418, 457",
      url: "https://doi.org/10.1086/173407",
    },
    {
      title:
        "Miller Bertolami (2016), New models for the evolution of post-asymptotic giant branch stars and central stars of planetary nebulae, A&A 588, A25",
      url: "https://doi.org/10.1051/0004-6361/201526577",
    },
    {
      title: "Bédard et al. (2020), the Montreal white dwarf cooling sequences",
      url: "https://www.astro.umontreal.ca/~bergeron/CoolingModels/",
    },
    {
      title:
        "Gough (1981), Solar interior structure and luminosity variations, Solar Physics 74, 21",
      url: "https://doi.org/10.1007/BF00151270",
    },
    {
      title: "Kopparapu et al. (2013), Habitable zones around main-sequence stars, ApJ 765, 131",
      url: "https://doi.org/10.1088/0004-637X/765/2/131",
    },
    {
      title:
        "Standish & Williams, Keplerian elements for approximate positions of the major planets (JPL)",
      url: SOURCE_URLS.jplElements,
    },
  ],
};

export default specification;
