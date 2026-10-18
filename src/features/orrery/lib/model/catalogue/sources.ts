/**
 * Works the card figures are checked against (docs/science-sources.md lists them with the
 * figures that cite them). Links only where the ledger opened one.
 */
export type Source = { cite: string; link?: string };

export const SOURCES = {
  akeson2021: {
    cite: "Akeson et al. 2021, AJ 162, 14 (α Cen AB barycentre, Tables 8–9)",
    link: "https://doi.org/10.3847/1538-3881/abfaff",
  },
  allen2001: { cite: "Allen, Bernstein & Malhotra 2001, ApJ 549, L241 (the Kuiper cliff)" },
  avdellidou2024: {
    cite: "Avdellidou et al. 2024, Science 384, 348; Nesvorný et al. 2018, Nat. Astron. 2, 878",
    link: "https://doi.org/10.1126/science.adg8092",
  },
  barboni2017: {
    cite: "Barboni et al. 2017, Sci. Adv. 3, e1602365; Borg et al. 2011, Nature 477, 70",
  },
  bennettBovy2019: {
    cite: "Bennett & Bovy 2019, MNRAS 482, 1417",
    link: "https://arxiv.org/abs/1809.03507",
  },
  binggeli1985: { cite: "Binggeli, Sandage & Tammann 1985, AJ 90, 1681" },
  blakeslee2009: {
    cite: "Blakeslee et al. 2009, ApJ 694, 556",
    link: "https://arxiv.org/abs/0901.1138",
  },
  blandHawthorn2016: {
    cite: "Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529",
    link: "https://arxiv.org/abs/1602.07702",
  },
  bovy2017: { cite: "Bovy 2017, MNRAS 468, L63 (Oort constants)" },
  chen2019: {
    cite: "Chen et al. 2019, Nat. Astron. 3, 320 (Cepheid warp, Table 1)",
    link: "https://arxiv.org/abs/1902.00998",
  },
  connelly2012: {
    cite: "Connelly et al. 2012, Science 338, 651",
    link: "https://doi.org/10.1126/science.1226919",
  },
  devaucouleurs1958: { cite: "de Vaucouleurs 1958 (the Local Supercluster)" },
  diskLifetimes: {
    cite: "Haisch, Lada & Lada 2001, ApJ 553, L153; Mamajek 2009",
    link: "https://arxiv.org/abs/0906.5011",
  },
  drinkwater2001: { cite: "Drinkwater et al. 2001, ApJ 548, L139" },
  duncan1987: { cite: "Duncan, Quinn & Tremaine 1987, AJ 94, 1330; NASA Oort cloud facts" },
  dupuy2019: {
    cite: "Dupuy et al. 2019, AJ 158, 174",
    link: "https://doi.org/10.3847/1538-3881/ab3cd1",
  },
  dupuyCourtois2023: { cite: "Dupuy & Courtois 2023, A&A 678, A176" },
  eht2019: {
    cite: "Event Horizon Telescope Collaboration 2019, Paper VI, ApJL 875, L6",
    link: "https://arxiv.org/abs/1906.11243",
  },
  eilers2019: { cite: "Eilers et al. 2019, ApJ 871, 120" },
  ferguson1989: { cite: "Ferguson 1989, AJ 98, 367 (Fornax Cluster Catalog)" },
  gaiaDr3: {
    cite: "Gaia Collaboration 2023, A&A 674, A1 (Gaia DR3)",
    link: "https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/355/gaiadr3",
  },
  gaiaEnceladus: {
    cite: "Helmi et al. 2018, Nature 563, 85; Belokurov et al. 2018, MNRAS 478, 611",
  },
  gravity2021: { cite: "GRAVITY Collaboration 2021, A&A 647, A59; GRAVITY Collaboration 2022" },
  gravity2022: { cite: "GRAVITY Collaboration 2022 (Sgr A* mass)" },
  horizon: { cite: "Horizon model: a labelled teaching choice" },
  hubbleFlow: {
    cite: "NED (cz 3,418 km/s) and Christlein & Zabludoff 2003 (cz 3,683 km/s), at the model's H₀",
  },
  iau2012b2: { cite: "IAU 2012 Resolution B2 (the astronomical unit)" },
  iau2015b3: { cite: "IAU 2015 Resolution B3 (nominal solar and planetary values)" },
  iodice2019: {
    cite: "Iodice et al. 2019, A&A 623, A1 (§1: after Virgo, the most massive concentration within 20 Mpc)",
    link: "https://arxiv.org/abs/1812.01050",
  },
  iorio2012: { cite: "Iorio 2012, Sol. Phys. 281, 815; NSSDC fact sheets" },
  jplElements: {
    cite: "JPL approximate planetary elements (Standish & Williams)",
    link: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  },
  jplHorizons: { cite: "JPL Horizons (Sedna barycentric; Halley 1994 osculating elements)" },
  jplRadii: {
    cite: "JPL planetary physical parameters (IAU 2015 mean radii)",
    link: "https://ssd.jpl.nasa.gov/planets/phys_par.html",
  },
  kaibVolk2022: {
    cite: "Kaib & Volk 2022 (after Heisler & Tremaine 1986)",
    link: "https://arxiv.org/abs/2206.00010",
  },
  kervella2017: { cite: "Kervella, Thévenin & Lovis 2017, A&A 598, L7" },
  kokubo1998: { cite: "Kokubo & Ida 1998, Icarus 131, 171 (text not opened)" },
  lecar2006: {
    cite: "Lecar et al. 2006, ApJ 640, 1115",
    link: "https://arxiv.org/abs/astro-ph/0602217",
  },
  lhb: { cite: "Zellner 2017, OLEB 47, 261; Boehnke & Harrison 2016, PNAS 113, 10802" },
  li2021: {
    cite: "Li et al. 2021, ApJ 920, 84",
    link: "https://doi.org/10.3847/1538-4357/ac1597",
  },
  liu2011: { cite: "Liu, Zhu & Zhang 2011, A&A 526, A16" },
  lucey2023: {
    cite: "Wegg, Gerhard & Portail 2015 (5.0 ± 0.2 kpc half-length); Lucey et al. 2023, MNRAS (~3.5 kpc)",
    link: "https://arxiv.org/abs/2206.01798",
  },
  lyndenBell1988: { cite: "Lynden-Bell et al. 1988, ApJ 326, 19" },
  m31Merger: {
    cite: "van der Marel et al. 2019, ApJ 872, 24; Sawala et al. 2025, Nat. Astron.; Wu et al. 2026, ApJL",
  },
  m31Width: {
    cite: "RC3, de Vaucouleurs et al. 1991 (NGC 224: log D25 = 3.28); Ibata et al. 2005, ApJ 634, 287 (outer disk to ~40 kpc, arXiv:astro-ph/0504164)",
    link: "https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=VII/155",
  },
  mamajek2015: { cite: "Mamajek et al. 2015, ApJL 800, L17" },
  mcconnachie2012: {
    cite: "McConnachie 2012, AJ 144, 4",
    link: "https://arxiv.org/abs/1204.1562",
  },
  mcconnachie2019: {
    cite: "McConnachie, nearby galaxies catalogue after McConnachie 2012 (Table 1, October 2019)",
    link: "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/",
  },
  mclaughlin1999: { cite: "McLaughlin 1999, ApJ 512, L9 (Virgo r₂₀₀ = 1.55 Mpc)" },
  mei2007: { cite: "Mei et al. 2007, ApJ 655, 144" },
  morbidelli2005: {
    cite: "Morbidelli 2005 review, after Gomes et al. 2005; Tsiganis et al. 2005, Nature 435, 459",
    link: "https://arxiv.org/abs/astro-ph/0512256",
  },
  mpcTno: {
    cite: "Minor Planet Center, list of trans-Neptunian objects",
    link: "https://minorplanetcenter.net/iau/lists/TNOs.html",
  },
  nasaKuiper: {
    cite: "NASA Kuiper Belt facts; Pitjeva & Pitjev 2018",
    link: "https://science.nasa.gov/solar-system/kuiper-belt/facts/",
  },
  nasaM33: { cite: "NASA/HST, Triangulum Galaxy (M33): 18.7 kpc optical diameter" },
  nasaMilkyWay: { cite: "NASA Science, Beyond Our Solar System: the Milky Way" },
  nssdc: { cite: "NSSDC planetary fact sheets" },
  pasquini2004: {
    cite: "Pasquini et al. 2004, A&A 426, 651",
    link: "https://arxiv.org/abs/astro-ph/0407524",
  },
  pitjeva2018: {
    cite: "Pitjeva & Pitjev 2018, Astron. Lett. 44, 554",
    link: "https://arxiv.org/abs/1811.05191",
  },
  planck2018: { cite: "Planck Collaboration 2020, A&A 641, A6 (TT,TE,EE+lowE+lensing+BAO)" },
  reid2019: { cite: "Reid et al. 2019, ApJ 885, 131" },
  richter1989: { cite: "Richter 1989, catalogue of 581 galaxies in the Hydra I cluster area" },
  sanders2024: { cite: "Sanders et al. 2024, MNRAS 530, 2972; Xiang & Rix 2022, Nature 603, 599" },
  tully1982: {
    cite: "Tully 1982, ApJ 257, 389 (Table 1: the Virgo Cluster and ten clouds)",
    link: "https://adsabs.harvard.edu/pdf/1982ApJ...257..389T",
  },
  tully2008: {
    cite: "Tully et al. 2008, ApJ 676, 184",
    link: "https://arxiv.org/abs/0705.4139",
  },
  tully2014: { cite: "Tully et al. 2014, Nature 513, 71" },
  vallee2017: {
    cite: "Vallée 2017, Astron. Rev. 13, 113",
    link: "https://arxiv.org/abs/1711.05228",
  },
  vanDerMarel2012: { cite: "van der Marel et al. 2012, ApJ 753, 8" },
  wegg2015: {
    cite: "Wegg, Gerhard & Portail 2015, MNRAS 450, 4050",
    link: "https://arxiv.org/abs/1504.01401",
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
