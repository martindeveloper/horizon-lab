import { ATLAS_SOURCES } from "@/space/cosmos/model/atlas";
import { CREDIT_URLS, SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["views", "depth", "objects"],
  sections: [
    {
      id: "solar",
      equations: [
        {
          equation: "kepler-third-law",
        },
        {
          equation: "light-travel-time",
        },
      ],
    },
    {
      id: "stars",
      equations: [
        "r = (1000 / ϖ) pc · (cos δ cos α, cos δ sin α, sin δ), rotated into the ecliptic frame",
        {
          equation: "tangential-velocity",
        },
        "r(t) = r₀ − v t,  closest at t = (r₀ · v) / |v|²",
      ],
    },
    {
      id: "galaxy",
      equations: [
        {
          equation: "galactic-angle",
        },
        {
          equation: "galactic-radius",
        },
        {
          equation: "galactic-height",
        },
        {
          equation: "spiral-arm",
        },
        "n ∝ e^(−R / 2.6 kpc − |z| / 0.3 kpc)",
        {
          equation: "galactic-warp",
        },
      ],
    },
    {
      id: "cosmos",
      equations: [
        {
          equation: "local-group-orbit",
        },
        "D_C(z) = (c / H₀) ∫ da / (a² E(a)),  E(a) = √(Ω_r a⁻⁴ + Ω_m a⁻³ + Ω_Λ)",
        "D_horizon = D_C(∞),  D_CMB = D_C(1089.8)",
      ],
    },
    {
      id: "depth",
      equations: [
        {
          equation: "light-travel-time",
        },
        "z: D_C(z) = d, by bisection in ln(1 + z)",
        "t_lookback = t₀ − t(a = 1 / (1 + z))",
      ],
    },
  ],
  references: [
    ...Object.values(ATLAS_SOURCES).map((source) => ({
      title: `${source.version} · ${source.publication}`,
      url: source.referenceUrl,
    })),
    {
      title:
        "GRAVITY Collaboration (2021), Improved GRAVITY astrometric accuracy from modeling optical aberrations, A&A 647, A59",
      url: SOURCE_URLS.gravity2021,
    },
    {
      title:
        "Bland-Hawthorn & Gerhard (2016), The Galaxy in context: structural, kinematic, and integrated properties, ARA&A 54, 529",
      url: SOURCE_URLS.blandHawthorn2016Doi,
    },
    {
      title:
        "Reid et al. (2019), Trigonometric parallaxes of high-mass star-forming regions: our view of the Milky Way, ApJ 885, 131",
      url: SOURCE_URLS.reid2019,
    },
    {
      title:
        "Vallée (2017), A guided map to the spiral arms in the galactic disk of the Milky Way, Astronomical Review 13, 113",
      url: SOURCE_URLS.vallee2017Doi,
    },
    {
      title:
        "Churchwell et al. (2009), The Spitzer/GLIMPSE surveys: a new view of the Milky Way, PASP 121, 213",
      url: SOURCE_URLS.churchwell2009,
    },
    {
      title:
        "Wegg, Gerhard & Portail (2015), The structure of the Milky Way's bar outside the bulge, MNRAS 450, 4050",
      url: SOURCE_URLS.wegg2015Doi,
    },
    {
      title:
        "Chen et al. (2019), An intuitive 3D map of the Galactic warp's precession traced by classical Cepheids, Nature Astronomy 3, 320",
      url: SOURCE_URLS.chen2019Doi,
    },
    {
      title:
        "Eilers et al. (2019), The circular velocity curve of the Milky Way from 5 to 25 kpc, ApJ 871, 120",
      url: SOURCE_URLS.eilers2019,
    },
    {
      title:
        "Bennett & Bovy (2019), Vertical waves in the solar neighbourhood in Gaia DR2, MNRAS 482, 1417",
      url: SOURCE_URLS.bennettBovy2019Doi,
    },
    {
      title:
        "Connelly et al. (2012), The absolute chronology and thermal processing of solids in the solar protoplanetary disk, Science 338, 651",
      url: SOURCE_URLS.connelly2012,
    },
    {
      title:
        "Helmi et al. (2018), The merger that led to the formation of the Milky Way's inner stellar halo and thick disk, Nature 563, 85",
      url: SOURCE_URLS.helmi2018,
    },
    {
      title:
        "Belokurov et al. (2018), Co-formation of the disc and the stellar halo, MNRAS 478, 611",
      url: SOURCE_URLS.belokurov2018,
    },
    {
      title:
        "Gaia Collaboration, Vallenari et al. (2023), Gaia Data Release 3: Summary of the content and survey properties, A&A 674, A1",
      url: SOURCE_URLS.gaia2023,
    },
    {
      title:
        "Mamajek et al. (2015), The closest known flyby of a star to the Solar System, ApJL 800, L17",
      url: SOURCE_URLS.mamajek2015,
    },
    {
      title: "Dupuy et al. (2019), WISE J072003.20−084651.2B is a massive T dwarf, AJ 158, 174",
      url: SOURCE_URLS.dupuy2019,
    },
    {
      title:
        "Kervella et al. (2016), Close stellar conjunctions of α Centauri A and B until 2050, A&A 594, A107",
      url: SOURCE_URLS.kervella2016,
    },
    {
      title: "Kervella, Thévenin & Lovis (2017), Proxima's orbit around α Centauri, A&A 598, L7",
      url: SOURCE_URLS.kervella2017,
    },
    {
      title:
        "Akeson et al. (2021), Precision millimeter astrometry of the α Centauri AB system, AJ 162, 14",
      url: SOURCE_URLS.akeson2021,
    },
    {
      title:
        "Planck Collaboration (2020), Planck 2018 results VI: Cosmological parameters, A&A 641, A6",
      url: CREDIT_URLS.planck,
    },
    {
      title:
        "Tully, Courtois, Hoffman & Pomarède (2014), The Laniakea supercluster of galaxies, Nature 513, 71",
      url: SOURCE_URLS.tully2014,
    },
    {
      title:
        "van der Marel et al. (2012), The M31 velocity vector II: radial orbit toward the Milky Way and implied Local Group mass, ApJ 753, 8",
      url: SOURCE_URLS.vanDerMarel2012,
    },
    {
      title:
        "McConnachie (2012), The observed properties of dwarf galaxies in and around the Local Group, AJ 144, 4",
      url: SOURCE_URLS.mcconnachie2012Doi,
    },
    {
      title:
        "Mei et al. (2007), The ACS Virgo Cluster Survey XIII: SBF distance catalog and the three-dimensional structure of the Virgo Cluster, ApJ 655, 144",
      url: SOURCE_URLS.mei2007,
    },
    {
      title:
        "Sawala et al. (2025), No certainty of a Milky Way–Andromeda collision, Nature Astronomy",
      url: SOURCE_URLS.sawala2025,
    },
    {
      title: "Tully et al. (2008), Our peculiar motion away from the Local Void, ApJ 676, 184",
      url: SOURCE_URLS.tully2008Doi,
    },
    {
      title:
        "Zwicky (1933), Die Rotverschiebung von extragalaktischen Nebeln, Helvetica Physica Acta 6, 110",
      url: SOURCE_URLS.zwicky1933,
    },
    {
      title:
        "Wegner, Haynes & Giovanelli (1993), A survey of the Pisces-Perseus Supercluster. V. The declination strip +33.5° to +39.5° and the main supercluster ridge, AJ 105, 1251",
      url: SOURCE_URLS.wegner1993,
    },
    {
      title:
        "Geller, Diaferio & Kurtz (1999), The mass profile of the Coma galaxy cluster, ApJ 517, L23",
      url: SOURCE_URLS.geller1999,
    },
    {
      title: "Gott et al. (2005), A map of the universe, ApJ 624, 463",
      url: SOURCE_URLS.gott2005,
    },
    {
      title:
        "Proust et al. (2006), Structure and dynamics of the Shapley Supercluster, A&A 447, 133",
      url: SOURCE_URLS.proust2006,
    },
    {
      title:
        "Pedratti et al. (2026), Novel insights into the Coma cluster kinematics with DESI. I. Linking mass profile, orbital anisotropy, and galaxy populations, A&A 710, A218",
      url: SOURCE_URLS.pedratti2026,
    },
    {
      title: "Fixsen (2009), The temperature of the cosmic microwave background, ApJ 707, 916",
      url: SOURCE_URLS.fixsen2009,
    },
  ],
};

export default specification;
