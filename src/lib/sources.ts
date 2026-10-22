import { SOURCE_URLS } from "@horizon/toolkit/urls";
/**
 * Works the card figures are checked against (docs/science-sources.md lists them with the
 * figures that cite them). Links only where the ledger opened one.
 */
export type Source = { cite: string; link?: string };

export const SOURCES = {
  agol2021: {
    cite: "Agol et al. 2021, PSJ 2, 1 (TRAPPIST-1: radius, mass and temperature)",
    link: SOURCE_URLS.agol2021,
  },
  akeson2021: {
    cite: "Akeson et al. 2021, AJ 162, 14 (α Cen AB barycentre, Tables 8–9)",
    link: SOURCE_URLS.akeson2021,
  },
  allen2001: { cite: "Allen, Bernstein & Malhotra 2001, ApJ 549, L241 (the Kuiper cliff)" },
  archinal2018: {
    cite: "Archinal et al. 2018, Celest. Mech. Dyn. Astron. 130, 22 (IAU WGCCRE 2015: rotational elements of the planets)",
  },
  arroyoTorres2013: {
    cite: "Arroyo-Torres et al. 2013, A&A 554, A76 (UY Scuti's angular diameter)",
  },
  asplund2009: {
    cite: "Asplund et al. 2009, ARA&A 47, 481 (the Sun's photospheric composition)",
  },
  aufdenberg2005: {
    cite: "Aufdenberg, Ludwig & Kervella 2005, ApJ 633, 424 (Procyon A's limb-darkened diameter: R = 2.031 ± 0.013 R☉)",
  },
  avdellidou2024: {
    cite: "Avdellidou et al. 2024, Science 384, 348; Nesvorný et al. 2018, Nat. Astron. 2, 878; Edwards et al. 2024, Nat. Astron. 8, 1264 (an earlier instability)",
    link: SOURCE_URLS.avdellidou2024,
  },
  barboni2017: {
    cite: "Barboni et al. 2017, Sci. Adv. 3, e1602365; Borg et al. 2011, Nature 477, 70; Nimmo, Kleine & Morbidelli 2024, Nature 636, 598 (younger ages as remelting)",
  },
  baumgardt2021: {
    cite: "Baumgardt & Vasiliev 2021, MNRAS 505, 5957 (globular cluster distances: ω Cen 5.43 kpc)",
  },
  bennettBovy2019: {
    cite: "Bennett & Bovy 2019, MNRAS 482, 1417",
    link: SOURCE_URLS.bennettBovy2019,
  },
  binggeli1985: { cite: "Binggeli, Sandage & Tammann 1985, AJ 90, 1681" },
  blakeslee2009: {
    cite: "Blakeslee et al. 2009, ApJ 694, 556",
    link: SOURCE_URLS.blakeslee2009,
  },
  blandHawthorn2016: {
    cite: "Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529",
    link: SOURCE_URLS.blandHawthorn2016,
  },
  bogdanov2019: {
    cite: "Bogdanov et al. 2019, ApJL 887, L25 (PSR J0030+0451's NICER data set: spin period 4.87 ms)",
    link: SOURCE_URLS.bogdanov2019,
  },
  bond2015: { cite: "Bond et al. 2015, ApJ 813, 106 (Procyon A's dynamical mass)" },
  bond2017: {
    cite: "Bond et al. 2017, ApJ 840, 70 (the masses of Sirius A and B; Sirius B's radius and temperature; Sirius A's temperature after Davis et al. 2011)",
    link: SOURCE_URLS.bond2017,
  },
  borexino2018: {
    cite: "Borexino Collaboration 2018, Nature 562, 505 (the Sun's proton–proton chain, measured by its neutrinos)",
    link: SOURCE_URLS.borexino2018,
  },
  borexino2020: {
    cite: "Borexino Collaboration 2020, Nature 587, 577 (the Sun's CNO cycle, measured by its neutrinos: about 1 % of its power)",
    link: SOURCE_URLS.borexino2020,
  },
  bovy2017: { cite: "Bovy 2017, MNRAS 468, L63 (Oort constants)" },
  brands2022: {
    cite: "Brands et al. 2022, A&A 663, A36 (R136's most massive stars)",
    link: SOURCE_URLS.brands2022,
  },
  breuval2023: {
    cite: "Breuval et al. 2023, ApJ 951, 118 (M33 at 840 ± 11 kpc from HST Cepheids)",
    link: SOURCE_URLS.breuval2023,
  },
  castelli1994: {
    cite: "Castelli & Kurucz 1994, A&A 281, 817 (a model-atmosphere fit to Vega's disc-integrated light)",
  },
  chabrier2000: {
    cite: "Chabrier & Baraffe 2000, ARA&A 38, 337 (low-mass stars and brown dwarfs: fully convective below about 0.4 M☉; brown dwarfs too light to burn hydrogen)",
    link: SOURCE_URLS.chabrier2000,
  },
  chen2019: {
    cite: "Chen et al. 2019, Nat. Astron. 3, 320 (Cepheid warp, Table 1)",
    link: SOURCE_URLS.chen2019,
  },
  collins2017: {
    cite: "Collins, Jones & Barnes 2017, A&A 602, A48 (Proxima Centauri's rotation, 82.6 ± 0.1 d)",
    link: SOURCE_URLS.collins2017,
  },
  connelly2012: {
    cite: "Connelly et al. 2012, Science 338, 651",
    link: SOURCE_URLS.connelly2012,
  },
  crowther2010: {
    cite: "Crowther et al. 2010, MNRAS 408, 731 (R136's WN5h stars, hydrogen-rich and very massive)",
  },
  davies2007: { cite: "Davies et al. 2007, ApJ 671, 781 (the red supergiants of Stephenson 2)" },
  devaucouleurs1958: { cite: "de Vaucouleurs 1958 (the Local Supercluster)" },
  diskLifetimes: {
    cite: "Haisch, Lada & Lada 2001, ApJ 553, L153; Mamajek 2009",
    link: SOURCE_URLS.diskLifetimes,
  },
  domiciano2014: {
    cite: "Domiciano de Souza et al. 2014, A&A 569, A10 (Achernar's flattened shape)",
    link: SOURCE_URLS.domiciano2014,
  },
  drinkwater2001: { cite: "Drinkwater et al. 2001, ApJ 548, L139" },
  duncan1987: { cite: "Duncan, Quinn & Tremaine 1987, AJ 94, 1330; NASA Oort cloud facts" },
  dupuy2019: {
    cite: "Dupuy et al. 2019, AJ 158, 174",
    link: SOURCE_URLS.dupuy2019,
  },
  dupuyCourtois2023: { cite: "Dupuy & Courtois 2023, A&A 678, A176" },
  eht2019: {
    cite: "Event Horizon Telescope Collaboration 2019, Paper VI, ApJL 875, L6",
    link: SOURCE_URLS.eht2019,
  },
  eht2022: {
    cite: "EHT Collaboration 2022, ApJL 930, L16 (Paper V); 2024 Paper VIII (Sgr A*: the a = 0.94 model)",
  },
  ehtM87Spin2026: { cite: "arXiv:2601.00394 (M87*'s ring asymmetry disfavours |a| ≲ 0.2)" },
  eilers2019: { cite: "Eilers et al. 2019, ApJ 871, 120" },
  farr2018: { cite: "Farr et al. 2018, AJ 156, 18 (Aldebaran's mass from its oscillations)" },
  ferguson1989: { cite: "Ferguson 1989, AJ 98, 367 (Fornax Cluster Catalog)" },
  fixsen2009: {
    cite: "Fixsen 2009, ApJ 707, 916 (T₀ = 2.7255 K; adopted by Planck 2018)",
    link: SOURCE_URLS.fixsen2009,
  },
  fok2012: {
    cite: "Fok et al. 2012, ApJ 760, 65 (Tables 6 and 8: Stephenson 2-18's adopted distance, temperature and luminosity)",
    link: SOURCE_URLS.fok2012,
  },
  gaiaDr3: {
    cite: "Gaia Collaboration 2023, A&A 674, A1 (Gaia DR3)",
    link: SOURCE_URLS.gaiaDr3,
  },
  gaiaEnceladus: {
    cite: "Helmi et al. 2018, Nature 563, 85; Belokurov et al. 2018, MNRAS 478, 611",
  },
  galanti2026: {
    cite: "Galanti et al. 2026, Nat. Astron. 10, 493 (Jupiter's 1-bar radii from Juno radio occultations)",
    link: SOURCE_URLS.galanti2026,
  },
  ge2019: {
    cite: "Ge et al. 2019, AJ 157, 148 (Table 2: TON 618, log M/M☉ = 10.610)",
    link: SOURCE_URLS.ge2019,
  },
  geller1999: {
    cite: "Geller, Diaferio & Kurtz 1999, ApJ 517, L23 (Coma: centre and median cz 7,090 km/s)",
    link: SOURCE_URLS.geller1999,
  },
  gott2005: {
    cite: "Gott et al. 2005, ApJ 624, 463 (the Sloan Great Wall)",
    link: SOURCE_URLS.gott2005,
  },
  gravity2020: {
    cite: "GRAVITY Collaboration 2020, A&A 636, L5 (S2's orbit: P = 16.0455 yr, pericentre ~120 au)",
    link: "https://doi.org/10.1051/0004-6361/202037813",
  },
  gravity2021: { cite: "GRAVITY Collaboration 2021, A&A 647, A59; GRAVITY Collaboration 2022" },
  gravity2022: {
    cite: "GRAVITY Collaboration 2022, A&A 657, L12 (Sgr A*: 4.297 × 10⁶ M☉, R₀ = 8,277 pc)",
    link: SOURCE_URLS.gravity2022,
  },
  haberle2024: {
    cite: "Häberle et al. 2024, Nature 631, 285 (ω Cen's fast central stars: an IMBH of at least 8,200 M☉)",
  },
  healy2024: {
    cite: "Healy et al. 2024, MNRAS 529, 3630; catalogue 2024-04-11, V* UY Sct (temperature, luminosity and distance)",
    link: SOURCE_URLS.healy2024,
  },
  heiter2015: {
    cite: "Heiter et al. 2015, A&A 582, A49 (Gaia benchmark stars: Aldebaran's temperature and luminosity)",
    link: SOURCE_URLS.heiter2015,
  },
  horizon: { cite: "Horizon model: a labelled teaching choice" },
  horizonsProbes: {
    cite: "JPL Horizons trajectories of Pioneer 10–11, Voyager 1–2 and New Horizons (heliocentric, ecliptic J2000)",
    link: SOURCE_URLS.horizonsProbes,
  },
  hubbleFlow: {
    cite: "NED (cz 3,418 km/s) and Christlein & Zabludoff 2003 (cz 3,683 km/s), at the model's H₀",
  },
  hummel2013: {
    cite: "Hummel et al. 2013, A&A 554, A52 (ζ Orionis A, Alnitak: the orbit and the stars' parameters)",
  },
  iau2012b2: { cite: "IAU 2012 Resolution B2 (the astronomical unit)" },
  iau2015b3: { cite: "IAU 2015 Resolution B3 (nominal solar and planetary values)" },
  iodice2019: {
    cite: "Iodice et al. 2019, A&A 623, A1 (§1: after Virgo, the most massive concentration within 20 Mpc)",
    link: SOURCE_URLS.iodice2019,
  },
  iorio2012: { cite: "Iorio 2012, Sol. Phys. 281, 815; NSSDC fact sheets" },
  joyce2020: {
    cite: "Joyce et al. 2020, ApJ 902, 63 (Betelgeuse: radius, mass, distance, and early core helium burning)",
    link: SOURCE_URLS.joyce2020,
  },
  jplElements: {
    cite: "JPL approximate planetary elements (Standish & Williams)",
    link: SOURCE_URLS.jplElements,
  },
  jplHorizons: { cite: "JPL Horizons (Sedna barycentric; Halley 1994 osculating elements)" },
  jplRadii: {
    cite: "JPL planetary physical parameters (IAU 2015 mean radii)",
    link: SOURCE_URLS.jplRadii,
  },
  jplSatElements: {
    cite: "JPL planetary satellite mean elements; several fitted to JPL Horizons, 2000–2032",
    link: SOURCE_URLS.jplSatElements,
  },
  jplSatRadii: {
    cite: "JPL planetary satellite physical parameters (IAU 2015 mean radii)",
    link: SOURCE_URLS.jplSatRadii,
  },
  kaibVolk2022: {
    cite: "Kaib & Volk 2022, Dynamical population of comet reservoirs, in Comets III (Univ. of Arizona Press, 2024; after Heisler & Tremaine 1986)",
    link: SOURCE_URLS.kaibVolk2022,
  },
  kamland2011: {
    cite: "KamLAND Collaboration 2011, Nat. Geosci. 4, 647 (geoneutrinos: radioactive decay supplies about half of Earth's heat)",
    link: SOURCE_URLS.kamland2011,
  },
  karachentsev2009: {
    cite: "Karachentsev et al. 2009, MNRAS 393, 1265 (Local Group zero-velocity radius 0.96 ± 0.03 Mpc)",
    link: SOURCE_URLS.karachentsev2009,
  },
  kervella2003: { cite: "Kervella et al. 2003, A&A 408, 681 (Sirius A's angular diameter)" },
  kervella2004: {
    cite: "Kervella et al. 2004, A&A 413, 251 (Procyon A's diameter and temperature)",
  },
  kervella2017: { cite: "Kervella, Thévenin & Lovis 2017, A&A 598, L7" },
  kervella2017ab: {
    cite: "Kervella et al. 2017, A&A 597, A137 (α Cen A and B: interferometric radii and temperatures)",
  },
  kervella2018: {
    cite: "Kervella et al. 2018, A&A 609, A67 (Betelgeuse's rotation from ALMA: P/sin i = 36 ± 8 yr)",
    link: SOURCE_URLS.kervella2018,
  },
  kervella2022: {
    cite: "Kervella et al. 2022, A&A 667, A111 (Achernar A: mass, temperature and luminosity)",
    link: SOURCE_URLS.kervella2022,
  },
  king2016: {
    cite: "King 2016, MNRAS 456, L109 (the thin-disk mass limit: TON 618 needs a ≳ 0.6)",
  },
  kippenhahn2012: {
    cite: "Kippenhahn, Weigert & Weiss 2012, Stellar Structure and Evolution, 2nd ed., Springer (hydrogen burning by the pp chain and CNO cycle, shell burning, helium burning, white-dwarf cooling)",
  },
  kokubo1998: {
    cite: "Kokubo & Ida 1998, Icarus 131, 171",
    link: SOURCE_URLS.kokubo1998,
  },
  lecar2006: {
    cite: "Lecar et al. 2006, ApJ 640, 1115",
    link: SOURCE_URLS.lecar2006,
  },
  lhb: { cite: "Zellner 2017, OLEB 47, 261; Boehnke & Harrison 2016, PNAS 113, 10802" },
  li2018: {
    cite: "Li et al. 2018, Nat. Commun. 9, 3709 (Jupiter's internal heat, from Cassini)",
    link: SOURCE_URLS.li2018,
  },
  li2021: {
    cite: "Li et al. 2021, ApJ 920, 84",
    link: SOURCE_URLS.li2021,
  },
  liu2011: { cite: "Liu, Zhu & Zhang 2011, A&A 526, A16" },
  lucey2023: {
    cite: "Wegg, Gerhard & Portail 2015 (5.0 ± 0.2 kpc half-length); Lucey et al. 2023, MNRAS 520, 4779 (~3.5 kpc)",
    link: SOURCE_URLS.lucey2023,
  },
  luger2017: {
    cite: "Luger et al. 2017, Nat. Astron. 1, 0129 (TRAPPIST-1 from K2: rotation 3.3 d)",
    link: SOURCE_URLS.luger2017,
  },
  lvk2025: {
    cite: "LIGO–Virgo–KAGRA Collaboration 2025, ApJL 993, L25 (GW231123: remnant mass, spin and distance)",
  },
  lyndenBell1988: { cite: "Lynden-Bell et al. 1988, ApJ 326, 19" },
  m31Merger: {
    cite: "van der Marel et al. 2019, ApJ 872, 24; Sawala et al. 2025, Nat. Astron. 9, 1206; Wu et al. 2026, ApJL 1001, L19",
  },
  m31Width: {
    cite: "RC3, de Vaucouleurs et al. 1991 (NGC 224: log D25 = 3.28); Ibata et al. 2005, ApJ 634, 287 (outer disk to ~40 kpc, arXiv:astro-ph/0504164)",
    link: SOURCE_URLS.m31Width,
  },
  mamajek2015: { cite: "Mamajek et al. 2015, ApJL 800, L17" },
  mcconnachie2012: {
    cite: "McConnachie 2012, AJ 144, 4",
    link: SOURCE_URLS.mcconnachie2012,
  },
  mcconnachie2019: {
    cite: "McConnachie, nearby galaxies catalogue after McConnachie 2012 (Table 1, October 2019)",
    link: SOURCE_URLS.mcconnachie2019,
  },
  mclaughlin1999: { cite: "McLaughlin 1999, ApJ 512, L9 (Virgo r₂₀₀ = 1.55 Mpc)" },
  mei2007: { cite: "Mei et al. 2007, ApJ 655, 144" },
  millerJones2021: {
    cite: "Miller-Jones et al. 2021, Science 371, 1046 (Cygnus X-1: 21.2 M☉ at 2.22 kpc)",
    link: SOURCE_URLS.millerJones2021,
  },
  monnier2012: { cite: "Monnier et al. 2012, ApJL 761, L3 (Vega, a rapid rotator seen pole-on)" },
  montet2015: {
    cite: "Montet et al. 2015, ApJ 800, 134 (LHS 6343 C: refined mass and radius)",
    link: SOURCE_URLS.montet2015,
  },
  moravveji2012: { cite: "Moravveji et al. 2012, ApJ 747, 108 (Rigel)" },
  morbidelli2005: {
    cite: "Morbidelli 2005 review, after Gomes et al. 2005; Tsiganis et al. 2005, Nature 435, 459",
    link: SOURCE_URLS.morbidelli2005,
  },
  mpcTno: {
    cite: "Minor Planet Center, list of trans-Neptunian objects",
    link: SOURCE_URLS.mpcTno,
  },
  nasaKuiper: {
    cite: "NASA Kuiper Belt facts; Pitjeva & Pitjev 2018",
    link: SOURCE_URLS.nasaKuiper,
  },
  nasaM33: { cite: "NASA/HST, Triangulum Galaxy (M33): 18.7 kpc optical diameter" },
  nasaMilkyWay: { cite: "NASA Science, Beyond Our Solar System: the Milky Way" },
  nssdc: { cite: "NSSDC planetary fact sheets" },
  ohnaka2013: { cite: "Ohnaka et al. 2013, A&A 555, A24 (Antares)" },
  panuzzo2024: {
    cite: "Gaia Collaboration (Panuzzo et al.) 2024, A&A 686, L2 (Gaia BH3: mass and distance)",
  },
  pasquini2004: {
    cite: "Pasquini et al. 2004, A&A 426, 651",
    link: SOURCE_URLS.pasquini2004,
  },
  pedratti2026: {
    cite: "Pedratti et al. 2026, A&A 710, A218 (Coma members and M₂₀₀ from DESI)",
    link: SOURCE_URLS.pedratti2026,
  },
  pietrzynski2019: {
    cite: "Pietrzyński et al. 2019, Nature 567, 200 (the Large Magellanic Cloud at 49.59 kpc)",
  },
  pitjeva2018: {
    cite: "Pitjeva & Pitjev 2018, Astron. Lett. 44, 554",
    link: SOURCE_URLS.pitjeva2018,
  },
  planck2018: {
    cite: "Planck Collaboration 2020, A&A 641, A6 (TT,TE,EE+lowE+lensing+BAO; Table 2: z∗ = 1089.80)",
    link: SOURCE_URLS.planck2018,
  },
  pourbaix2002: { cite: "Pourbaix et al. 2002, A&A 386, 280 (α Cen B's visual orbit about A)" },
  proust2006: {
    cite: "Proust et al. 2006, A&A 447, 133 (the Shapley Supercluster)",
    link: SOURCE_URLS.proust2006,
  },
  przybilla2010: {
    cite: "Przybilla et al. 2010, A&A 517, A38 (Rigel's evolutionary mass, Table 1)",
    link: SOURCE_URLS.przybilla2010,
  },
  ramachandran2025: {
    cite: "Ramachandran et al. 2025, A&A 698, A37 (Cygnus X-1 from wind models: 12.7–17.8 M☉)",
    link: "https://arxiv.org/abs/2504.05885",
  },
  ramirez2011: { cite: "Ramírez & Allende Prieto 2011, ApJ 743, 135 (Arcturus)" },
  reid2019: { cite: "Reid et al. 2019, ApJ 885, 131" },
  ribas2017: {
    cite: "Ribas et al. 2017, A&A 603, A58 (Proxima's temperature and luminosity)",
    link: SOURCE_URLS.ribas2017,
  },
  richichi2005: {
    cite: "Richichi & Roccatagliata 2005, A&A 433, 305 (Aldebaran's angular diameter)",
  },
  richter1989: {
    cite: "Richter 1989, A&AS 77, 237 (the Hydra I cluster: a catalogue of 581 galaxies in its area)",
  },
  riley2019: {
    cite: "Riley et al. 2019, ApJL 887, L21 (PSR J0030+0451 measured with NICER)",
    link: SOURCE_URLS.riley2019,
  },
  sanders2024: { cite: "Sanders et al. 2024, MNRAS 530, 2972; Xiang & Rix 2022, Nature 603, 599" },
  schiller2008: { cite: "Schiller & Przybilla 2008, A&A 479, 849 (Deneb)" },
  shemmer2004: {
    cite: "Shemmer et al. 2004, ApJ 614, 547 (Table 2: TON 618, log M/M☉ = 10.82)",
    link: SOURCE_URLS.shemmer2004,
  },
  simbad: {
    cite: "SIMBAD Astronomical Database, CDS Strasbourg (radial velocities as it adopts them)",
  },
  snodgrass1990: {
    cite: "Snodgrass & Ulrich 1990, ApJ 351, 309 (the Sun's rotation from Doppler features, by latitude)",
    link: SOURCE_URLS.snodgrass1990,
  },
  steiner2024: { cite: "Steiner et al. 2024 (IXPE: Cygnus X-1's spin ≳ 0.96 in its soft state)" },
  stone2005: {
    cite: "Stone et al. 2005, Science 309, 2017 (Voyager 1 crosses the termination shock)",
    link: SOURCE_URLS.stone2005,
  },
  stone2008: {
    cite: "Stone et al. 2008, Nature 454, 71 (Voyager 2 at the termination shock)",
    link: SOURCE_URLS.stone2008,
  },
  stone2013: {
    cite: "Stone et al. 2013, Science 341, 150 (Voyager 1 enters interstellar space)",
    link: SOURCE_URLS.stone2013,
  },
  stone2019: {
    cite: "Stone et al. 2019, Nat. Astron. 3, 1013 (Voyager 2 crosses the heliopause)",
    link: SOURCE_URLS.stone2019,
  },
  struble1999: {
    cite: "Struble & Rood 1999, ApJS 125, 35 (Perseus cz 5,366 km/s, as quoted by Penny et al. 2010)",
  },
  tully1982: {
    cite: "Tully 1982, ApJ 257, 389 (Table 1: the Virgo Cluster and ten clouds)",
    link: SOURCE_URLS.tully1982,
  },
  tully2008: {
    cite: "Tully et al. 2008, ApJ 676, 184",
    link: SOURCE_URLS.tully2008,
  },
  tully2014: { cite: "Tully et al. 2014, Nature 513, 71" },
  vallee2017: {
    cite: "Vallée 2017, Astron. Rev. 13, 113",
    link: SOURCE_URLS.vallee2017,
  },
  vanDerMarel2012: { cite: "van der Marel et al. 2012, ApJ 753, 8" },
  vanLeeuwen2007: { cite: "van Leeuwen 2007, A&A 474, 653 (Hipparcos, the new reduction)" },
  wegg2015: {
    cite: "Wegg, Gerhard & Portail 2015, MNRAS 450, 4050",
    link: SOURCE_URLS.wegg2015,
  },
  wegner1993: { cite: "Wegner, Haynes & Giovanelli 1993, AJ 105, 1251 (the Perseus–Pisces ridge)" },
  wittkowski2012: { cite: "Wittkowski et al. 2012, A&A 540, L12 (VY Canis Majoris)" },
  woudt2008: {
    cite: "Woudt et al. 2008, MNRAS 383, 445 (the Norma cluster: 4,871 ± 54 km/s)",
    link: SOURCE_URLS.woudt2008,
  },
  zhao2021: {
    cite: "Zhao et al. 2021, arXiv:2102.09093 (Cygnus X-1's spin > 0.9985 by continuum fitting)",
  },
  zwicky1933: {
    cite: "Zwicky 1933, Helv. Phys. Acta 6, 110 (Coma's missing mass)",
    link: SOURCE_URLS.zwicky1933,
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
