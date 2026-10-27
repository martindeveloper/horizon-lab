import { SOURCE_URLS } from "@horizon/toolkit/urls";
/**
 * Works the card figures are checked against (docs/science-sources.md lists them with the
 * figures that cite them). Links only where the ledger opened one.
 */
export type Source = { cite: string; link?: string };

export const SOURCES = {
  dauphas2011: {
    cite: "Dauphas & Pourmand 2011, Nature 473, 489 (Mars half-grown in 1.8 +0.9/−1.0 Myr, from hafnium–tungsten)",
  },
  feng2026: {
    cite: "Feng et al. 2026, MNRAS 546, stag011, Table 2 Mean (Gaia DR3 Cepheid rotation curve; inferred local density and dark mass inside 18 kpc)",
    link: "https://doi.org/10.1093/mnras/stag011",
  },
  brooks2026: {
    cite: "Brooks et al. 2026, MNRAS, stag926 (outer halo kinematics including the LMC; enclosed Milky Way mass)",
    link: "https://arxiv.org/abs/2603.08788v2",
  },
  dado2026: {
    cite: "Dado et al. 2026, MNRAS 552, stag1865 (baryonic contraction and biases in extrapolated halo mass)",
    link: "https://doi.org/10.1093/mnras/stag1865",
  },
  kruijer2017: {
    cite: "Kruijer, Burkhardt, Budde & Kleine 2017, PNAS 114, 6712 (Jupiter's core past ~20 Earth masses within ~1 Myr of the CAIs, from the two meteorite isotope families)",
  },
  navarro1997: {
    cite: "Navarro, Frenk & White 1997, ApJ 490, 493 (NFW density profile)",
    link: "https://doi.org/10.1086/304888",
  },
  cosmosWeb2026: {
    cite: "Scognamiglio et al. 2026, Nature Astronomy, An ultra-high-resolution map of (dark) matter; Supplementary Data 3, JWST E-mode convergence",
    link: "https://doi.org/10.1038/s41550-025-02763-9",
  },
  desiExpansion2026: {
    cite: "DESI Collaboration 2026, arXiv:2607.27410v3, PREPRINT (DR2 IV; Ly-alpha AP + BAO distance ratios, z_eff = 2.33)",
    link: "https://arxiv.org/abs/2607.27410v3",
  },
  cosmicflows4: {
    cite: "Tully et al. 2023, ApJ 944, 94, Cosmicflows-4 (CDS table 3: 38,053 groups; measured angles and CMB-frame redshifts)",
    link: "https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/ReadMe",
  },
  classix2025: {
    cite: "Böhringer et al. 2025, A&A 695, A59 (CLASSIX: Quipu and four other superstructures; Table 1 and CDS cluster catalogue; H₀ = 70)",
    link: "https://cdsarc.cds.unistra.fr/ftp/J/A+A/695/A59/ReadMe",
  },
  cosmicBasins2024: {
    cite: "Valade et al. 2024, Nature Astronomy, Identification of basins of attraction in the local Universe (CF4 posterior; Tables 1 and 2)",
    link: "https://arxiv.org/abs/2409.17261v1",
  },
  vela2026: {
    cite: "Hollinger et al. 2026, arXiv:2603.09339v2, accepted by A&A 22 June 2026 (CF4++ZOA; Vela, Table 2; masses at H₀ = 74.6)",
    link: "https://arxiv.org/abs/2603.09339v2",
  },
  cosmicVoids2026: {
    cite: "Hollinger & Courtois 2026, arXiv:2606.13538v1, PREPRINT (CF4++ZOA V-web, λth = 0; 37 voids and 42 knots, Tables A.1/A.2)",
    link: "https://arxiv.org/abs/2606.13538v1",
  },
  sloanBasin2026: {
    cite: "Pomarède et al. 2026, arXiv:2606.04578v1, PREPRINT (Sloan basin interpretation of the Valade et al. 2024 CF4 reconstruction)",
    link: "https://arxiv.org/abs/2606.04578v1",
  },
  southPole2020: {
    cite: "Pomarède et al. 2020, ApJ 897, 133, Cosmicflows-3: The South Pole Wall (approximate Chamaeleon+11.8 peak; §III)",
    link: "https://arxiv.org/abs/2007.04414v1",
  },
  desiDr1: {
    cite: "DESI DR1, iron zcatalog v1, 10 July 2026 (deterministic sparse sample of zpix-main-bright; selection in data/sources.json)",
    link: "https://data.desi.lbl.gov/doc/releases/dr1/",
  },
  nistIsotopeMasses: {
    cite: "NIST, Atomic Weights and Isotopic Compositions (neutral ¹H and ⁴He isotope masses, not natural-abundance atomic weights)",
    link: SOURCE_URLS.nistIsotopeMasses,
  },
  abbott2016: {
    cite: "Abbott et al. 2016, PRL 116, 061102; GWOSC GWTC-2.1 (GW150914: 34.6 and 30.0 M☉, ~1.3 Gly, ~3 M☉c² radiated)",
  },
  abdElDayem2026: {
    cite: "Abd El Dayem et al. 2026, Nature (S301: within 11.5–12.0 au of Sgr A* at 25,000–25,600 km/s)",
    link: SOURCE_URLS.abdElDayem2026,
  },
  agol2021: {
    cite: "Agol et al. 2021, PSJ 2, 1 (TRAPPIST-1: radius, mass and temperature)",
    link: SOURCE_URLS.agol2021,
  },
  akeson2021: {
    cite: "Akeson et al. 2021, AJ 162, 14 (α Cen AB barycentre, Tables 8–9)",
    link: SOURCE_URLS.akeson2021,
  },
  allen2001: { cite: "Allen, Bernstein & Malhotra 2001, ApJ 549, L241 (the Kuiper cliff)" },
  altschulerNewkirk1969: {
    cite: "Altschuler & Newkirk 1969, Sol. Phys. 9, 131 (the potential-field source-surface model: the source surface at 2.5 R☉)",
  },
  andersen2017: {
    cite: "Andersen et al. 2017, A&A 602, A22 (Westerlund 1's mass)",
  },
  archinal2018: {
    cite: "Archinal et al. 2018, Celest. Mech. Dyn. Astron. 130, 22 (IAU WGCCRE 2015: rotational elements of the planets)",
  },
  arroyoTorres2013: {
    cite: "Arroyo-Torres et al. 2013, A&A 554, A76 (UY Scuti's angular diameter)",
  },
  aschwanden2005: {
    cite: "Aschwanden 2005, Physics of the Solar Corona, 2nd ed., Springer (coronal temperatures; the flare frequency distribution, α ≈ 1.8)",
    link: SOURCE_URLS.aschwanden2005,
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
  banares2025: {
    cite: "Bañares-Hernández et al. 2025, A&A 693, A104 (ω Cen: any single IMBH below 6,000 M☉ at 3σ)",
    link: SOURCE_URLS.banares2025,
  },
  barboni2017: {
    cite: "Barboni et al. 2017, Sci. Adv. 3, e1602365; Borg et al. 2011, Nature 477, 70; Nimmo, Kleine & Morbidelli 2024, Nature 636, 598 (younger ages as remelting)",
  },
  baumbach1937: {
    cite: "Baumbach 1937, Astron. Nachr. 263, 121 (the corona's brightness with radius: 0.0532 r⁻²·⁵ + 1.425 r⁻⁷ + 2.565 r⁻¹⁷)",
  },
  baumgardt2021: {
    cite: "Baumgardt & Vasiliev 2021, MNRAS 505, 5957 (globular cluster distances: ω Cen 5.43 kpc)",
  },
  bender2005: {
    cite: "Bender et al. 2005, ApJ 631, 280 (M31*: 1.4 × 10⁸ M☉)",
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
  blundell2004: {
    cite: "Blundell & Bowler 2004, ApJ 616, L159 (SS 433's distance: 5.5 kpc)",
    link: SOURCE_URLS.blundell2004,
  },
  boerner2012: {
    cite: "Boerner et al. 2012, Sol. Phys. 275, 41 (SDO/AIA: the temperature response of each passband and the ions behind it)",
    link: SOURCE_URLS.boerner2012,
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
  celestrakGp: {
    cite: "CelesTrak, GP element sets of Hubble (NORAD 20580) and Chandra (25867): SGP4 mean elements, their epochs in observatory-orbits.json",
    link: SOURCE_URLS.celestrakGp,
  },
  chabrier2000: {
    cite: "Chabrier & Baraffe 2000, ARA&A 38, 337 (low-mass stars and brown dwarfs: fully convective below about 0.4 M☉; brown dwarfs too light to burn hydrogen)",
    link: SOURCE_URLS.chabrier2000,
  },
  charbonneau1999: {
    cite: "Charbonneau et al. 1999, ApJ 527, 445 (the tachocline from helioseismology: thickness 0.039 ± 0.013 R☉ under the convection zone's base at 0.713 R☉)",
    link: SOURCE_URLS.charbonneau1999,
  },
  chen2019: {
    cite: "Chen et al. 2019, Nat. Astron. 3, 320 (Cepheid warp, Table 1)",
    link: SOURCE_URLS.chen2019,
  },
  christensenDalsgaard1996: {
    cite: "Christensen-Dalsgaard et al. 1996, Science 272, 1286 (Model S: the standard solar model's run of temperature, density, pressure, luminosity and opacity)",
    link: SOURCE_URLS.christensenDalsgaard1996,
  },
  clark2005: {
    cite: "Clark et al. 2005, A&A 434, 949 (Westerlund 1's mass)",
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
  cxcSpecs: {
    cite: "Chandra X-ray Center, Chandra Specifications (13.8 m by 19.5 m with its solar arrays deployed)",
    link: SOURCE_URLS.cxcSpecs,
  },
  davies2007: { cite: "Davies et al. 2007, ApJ 671, 781 (the red supergiants of Stephenson 2)" },
  deRosa2012: {
    cite: "DeRosa, Brun & Hoeksema 2012, ApJ 757, 96 (the Sun's dipole through the cycle: the equatorial dipole dominates near maximum)",
    link: SOURCE_URLS.deRosa2012,
  },
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
  eddy1976: {
    cite: "Eddy 1976, Science 192, 1189 (the Maunder minimum, 1645–1715)",
    link: SOURCE_URLS.eddy1976,
  },
  eht2019: {
    cite: "Event Horizon Telescope Collaboration 2019, Paper VI, ApJL 875, L6",
    link: SOURCE_URLS.eht2019,
  },
  eht2022: {
    cite: "EHT Collaboration 2022, ApJL 930, L16 (Paper V); 2024 Paper VIII (Sgr A*: the a = 0.94 model)",
  },
  eht2022a: {
    cite: "EHT Collaboration 2022, ApJL 930, L12 (Paper I: Sgr A*'s 51.8 ± 2.3 μas ring)",
    link: SOURCE_URLS.eht2022a,
  },
  eht2025: {
    cite: "EHT Collaboration 2025, A&A 704, A91 (M87*'s ring over 2017, 2018 and 2021: 43.9 ± 0.6 μas)",
    link: SOURCE_URLS.eht2025,
  },
  ehtM87Spin2026: { cite: "arXiv:2601.00394 (M87*'s ring asymmetry disfavours |a| ≲ 0.2)" },
  eikenberry2001: {
    cite: "Eikenberry et al. 2001, ApJ 561, 1027 (SS 433's jets: β = 0.2647)",
    link: SOURCE_URLS.eikenberry2001,
  },
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
  fountain2008: {
    cite: "Fountain et al. 2008, Space Sci. Rev. 140, 23 (the New Horizons spacecraft: the 2.1 m high-gain antenna)",
    link: SOURCE_URLS.fountain2008,
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
  gravity2018: {
    cite: "GRAVITY Collaboration 2018, A&A 615, L15 (S2 at pericentre: 7,650 km/s)",
    link: SOURCE_URLS.gravity2018,
  },
  gravity2020: {
    cite: "GRAVITY Collaboration 2020, A&A 636, L5 (S2's orbit: P = 16.0455 yr, pericentre ~120 au)",
    link: SOURCE_URLS.gravity2020,
  },
  gravity2021: { cite: "GRAVITY Collaboration 2021, A&A 647, A59; GRAVITY Collaboration 2022" },
  gravity2022: {
    cite: "GRAVITY Collaboration 2022, A&A 657, L12 (Sgr A*: 4.297 × 10⁶ M☉, R₀ = 8,277 pc)",
    link: SOURCE_URLS.gravity2022,
  },
  haberle2024: {
    cite: "Häberle et al. 2024, Nature 631, 285 (ω Cen's fast central stars: an IMBH of at least 8,200 M☉)",
  },
  hathaway2015: {
    cite: "Hathaway 2015, LRSP 12, 4 (the solar cycle: period, rise and shape, spot latitudes, polar fields, the Maunder minimum)",
    link: SOURCE_URLS.hathaway2015,
  },
  healy2024: {
    cite: "Healy et al. 2024, MNRAS 529, 3630; catalogue 2024-04-11, V* UY Sct (temperature, luminosity and distance)",
    link: SOURCE_URLS.healy2024,
  },
  heiter2015: {
    cite: "Heiter et al. 2015, A&A 582, A49 (Gaia benchmark stars: Aldebaran's temperature and luminosity)",
    link: SOURCE_URLS.heiter2015,
  },
  hillier2001: {
    cite: "Hillier et al. 2001, ApJ 553, 837 (η Carinae's primary: ≳ 90 M☉)",
  },
  horizon: { cite: "Horizon model: a labelled teaching choice" },
  horizonsParker: {
    cite: "JPL Horizons, Parker Solar Probe (-96): heliocentric osculating elements, 1 June 2025 (e = 0.882, q = 6.862 million km, period 88.4 d)",
    link: SOURCE_URLS.horizonsParker,
  },
  horizonsParker2024: {
    cite: "JPL Horizons, Parker Solar Probe (-96): heliocentric osculating elements, 1 June and 1 October 2024 (e = 0.867, q = 7.956 million km, period 92.1 d), and its closest approach to Venus, 6 November 2024 18:44 UTC (6,433 km from Venus's centre)",
    link: SOURCE_URLS.horizonsParker,
  },
  horizonsProbes: {
    cite: "JPL Horizons trajectories of Pioneer 10–11, Voyager 1–2 and New Horizons (heliocentric, ecliptic J2000)",
    link: SOURCE_URLS.horizonsProbes,
  },
  horizonsWebb: {
    cite: "JPL Horizons, James Webb Space Telescope (-170): Goddard FDF reconstructed trajectory to October 2026, then predicted to October 2031 (geocentric, ecliptic J2000)",
    link: SOURCE_URLS.horizonsWebb,
  },
  hubbleFlow: {
    cite: "NED (cz 3,418 km/s) and Christlein & Zabludoff 2003 (cz 3,683 km/s), at the model's H₀",
  },
  hummel2013: {
    cite: "Hummel et al. 2013, A&A 554, A52 (ζ Orionis A, Alnitak: the orbit and the stars' parameters)",
  },
  iau2012b2: { cite: "IAU 2012 Resolution B2 (the astronomical unit)" },
  iau2015b3: { cite: "IAU 2015 Resolution B3 (nominal solar and planetary values)" },
  iers2010: {
    cite: "Petit & Luzum (eds.) 2010, IERS Conventions (2010), IERS Technical Note 36, Table 1.1 (Earth's J2)",
  },
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
  jplSbdb: {
    cite: "JPL Small-Body Database (Ceres, Haumea, Makemake and Eris: heliocentric osculating elements at epoch JD 2461200.5)",
    link: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html",
  },
  park2016: {
    cite: "Park et al. 2016, Nature 537, 515 (Dawn at Ceres: GM 62.6284 km³ s⁻², shape, spin)",
    link: "https://doi.org/10.1038/nature18955",
  },
  holler2021: {
    cite: "Holler et al. 2021, Icarus 355, 114130 (Eris–Dysnomia orbit: system mass 1.6466 × 10²² kg)",
    link: "https://doi.org/10.1016/j.icarus.2020.114130",
  },
  lellouch2010: {
    cite: "Lellouch et al. 2010, A&A 518, L147 (Haumea's thermal light curve; 3.915341 h rotation)",
    link: "https://doi.org/10.1051/0004-6361/201014648",
  },
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
  kasper2021: {
    cite: "Kasper et al. 2021, PRL 127, 255101 (Parker below the Alfvén critical surface at 18.8 R☉, 28 April 2021)",
    link: SOURCE_URLS.kasper2021,
  },
  kamland2011: {
    cite: "KamLAND Collaboration 2011, Nat. Geosci. 4, 647 (geoneutrinos: radioactive decay supplies about half of Earth's heat)",
    link: SOURCE_URLS.kamland2011,
  },
  karachentsev2009: {
    cite: "Karachentsev et al. 2009, MNRAS 393, 1265 (Local Group zero-velocity radius 0.96 ± 0.03 Mpc)",
    link: SOURCE_URLS.karachentsev2009,
  },
  karkoschka2011: {
    cite: "Karkoschka 2011, Icarus 215, 439 (Neptune's rotation from cloud features: 15.9663 h)",
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
  kounkel2017: {
    cite: "Kounkel et al. 2017, ApJ 834, 142 (the Orion Nebula's distance: 388 ± 5 pc)",
    link: SOURCE_URLS.kounkel2017,
  },
  lamy2025: {
    cite: "Lamy et al. 2025, Nature Astronomy 9, 658 (Uranus's rotation from auroral tracking: 17.247864 h)",
  },
  lecar2006: {
    cite: "Lecar et al. 2006, ApJ 640, 1115",
    link: SOURCE_URLS.lecar2006,
  },
  lemen2012: {
    cite: "Lemen et al. 2012, Sol. Phys. 275, 17 (SDO/AIA: the passbands and the temperatures of their peak response)",
    link: SOURCE_URLS.lemen2012,
  },
  lhb: { cite: "Zellner 2017, OLEB 47, 261; Boehnke & Harrison 2016, PNAS 113, 10802" },
  valley2014: {
    cite: "Valley et al. 2014, Nature Geoscience 7, 219 (Jack Hills zircon: Hadean crust at 4.4 Gyr)",
    link: "https://doi.org/10.1038/ngeo2075",
  },
  mittelholz2020: {
    cite: "Mittelholz et al. 2020, Science Advances 6, eaba0513 (Mars's dynamo active at 4.5 and 3.7 Gyr)",
    link: "https://doi.org/10.1126/sciadv.aba0513",
  },
  hartmannNeukum2001: {
    cite: "Hartmann & Neukum 2001, Space Science Reviews 96, 165 (Mars cratering chronology; Hesperian–Amazonian boundary 2.9–3.3 Gyr)",
    link: "https://doi.org/10.1023/A:1011945222010",
  },
  kamo1996: {
    cite: "Kamo, Reimold, Krogh & Colliston 1996, EPSL 144, 369 (Vredefort: 2023 ± 4 Myr)",
    link: "https://doi.org/10.1016/S0012-821X(96)00180-X",
  },
  li2021moon: {
    cite: "Li et al. 2021, Nature 600, 54 (Chang'e 5 basalts: lunar volcanism at 2030 ± 4 Myr)",
    link: "https://doi.org/10.1038/s41586-021-04100-2",
  },
  wang2024moon: {
    cite: "Wang et al. 2024, Science (Chang'e 5 volcanic glass beads: lunar volcanism 123 ± 15 Myr ago)",
  },
  kempf2023: {
    cite: "Kempf et al. 2023, Science Advances 9, eadf8537 (Saturn's rings: exposure age ≲100–400 Myr)",
    link: "https://doi.org/10.1126/sciadv.adf8537",
  },
  hyodo2025: {
    cite: "Hyodo, Genda & Madeira 2025, Nature Geoscience (vaporised micrometeoroids may leave Saturn's rings clean: a young look need not mean young rings)",
  },
  renne2013: {
    cite: "Renne et al. 2013, Science 339, 684 (Chicxulub's Haitian tektites: 66.038 ± 0.025 Myr, the boundary within 32 kyr of them)",
    link: "https://doi.org/10.1126/science.1230492",
  },
  li2018: {
    cite: "Li et al. 2018, Nat. Commun. 9, 3709 (Jupiter's internal heat, from Cassini)",
    link: SOURCE_URLS.li2018,
  },
  li2021: {
    cite: "Li et al. 2021, ApJ 920, 84",
    link: SOURCE_URLS.li2021,
  },
  linForbes2000: {
    cite: "Lin & Forbes 2000, JGR 105, 2375 (the two-dimensional flux-rope catastrophe model of a coronal mass ejection with reconnection)",
    link: SOURCE_URLS.linForbes2000,
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
  lvkSummary2025: {
    cite: "LIGO–Virgo–KAGRA science summary of GW231123, 2025 (the pair-instability gap, ~60–130 M☉)",
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
  mankovich2019: {
    cite: "Mankovich et al. 2019, ApJ 871, 1 (Saturn's interior rotation from ring seismology)",
  },
  margot2021: {
    cite: "Margot et al. 2021, Nature Astronomy 5, 676 (Venus's rotation: 243.0226 days, retrograde)",
  },
  mccomas2000: {
    cite: "McComas et al. 2000, JGR 105, 10419 (Ulysses: the slow and fast solar wind by latitude)",
    link: SOURCE_URLS.mccomas2000,
  },
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
  mitalasSills1992: {
    cite: "Mitalas & Sills 1992, ApJ 401, 759 (a photon's diffusion time from the Sun's centre: 1.7 × 10⁵ yr)",
    link: SOURCE_URLS.mitalasSills1992,
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
  nasaHubbleFacts: {
    cite: "NASA Goddard, A NASA Refresher on Hubble Facts (2015: 13.3 m long, 4.2 m maximum diameter)",
    link: SOURCE_URLS.nasaHubbleFacts,
  },
  nasaKuiper: {
    cite: "NASA Kuiper Belt facts; Pitjeva & Pitjev 2018",
    link: SOURCE_URLS.nasaKuiper,
  },
  nasaM33: { cite: "NASA/HST, Triangulum Galaxy (M33): 18.7 kpc optical diameter" },
  nasaMilkyWay: { cite: "NASA Science, Beyond Our Solar System: the Milky Way" },
  nasaParker: {
    cite: "NASA Science, Parker Solar Probe (the 24 December 2024 perihelion: its distance and speed)",
    link: SOURCE_URLS.nasaParker,
  },
  navarete2022: {
    cite: "Navarete et al. 2022; Negueruela et al. 2022, A&A 664, A146 (Westerlund 1's distance: 4.0–4.3 kpc)",
    link: SOURCE_URLS.navarete2022,
  },
  nordlund2009: {
    cite: "Nordlund, Stein & Asplund 2009, LRSP 6, 2 (solar surface convection: granule sizes and lifetimes, the photosphere's thickness)",
    link: SOURCE_URLS.nordlund2009,
  },
  nasaParkerShield: {
    cite: "NASA, Traveling to the Sun: Why Won’t Parker Solar Probe Melt? (2018; the heat shield, 2.4 m across)",
    link: SOURCE_URLS.nasaParkerShield,
  },
  nasaVoyager: {
    cite: "NASA Science, Voyager: the spacecraft (the 3.7 m high-gain antenna)",
    link: SOURCE_URLS.nasaVoyager,
  },
  nasaWebbFacts: {
    cite: "NASA Science, Webb fact sheet (sunshield 21.197 m by 14.162 m; orbits L2, 1.5 million km from Earth)",
    link: SOURCE_URLS.nasaWebbFacts,
  },
  nssdc: { cite: "NSSDC planetary fact sheets" },
  nssdcPioneer10: {
    cite: "NSSDC Master Catalog, Pioneer 10 (1972-012A; the 2.74 m dish)",
    link: SOURCE_URLS.nssdcPioneer10,
  },
  ohnaka2013: { cite: "Ohnaka et al. 2013, A&A 555, A24 (Antares)" },
  orosz2009: {
    cite: "Orosz et al. 2009, ApJ 697, 573 (LMC X-1: 10.91 ± 1.41 M☉)",
  },
  panuzzo2024: {
    cite: "Gaia Collaboration (Panuzzo et al.) 2024, A&A 686, L2 (Gaia BH3: mass and distance)",
  },
  parenti2014: {
    cite: "Parenti 2014, LRSP 11, 1 (solar prominences: sizes, lifetimes and kinds)",
    link: SOURCE_URLS.parenti2014,
  },
  park2021: { cite: "Park et al. 2021, AJ 161, 105 (JPL DE440/DE441: the planets' GMs)" },
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
  priest2014: {
    cite: "Priest 2014, Magnetohydrodynamics of the Sun, Cambridge Univ. Press (the Sun's layers and their temperatures, the mean field, the coronal green line)",
  },
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
    link: SOURCE_URLS.ramachandran2025,
  },
  ramirez2011: { cite: "Ramírez & Allende Prieto 2011, ApJ 743, 135 (Arcturus)" },
  reale2014: {
    cite: "Reale 2014, LRSP 11, 4 (coronal loops: the RTV scaling laws, temperatures of 0.8–3 MK from fans to active-region cores)",
    link: SOURCE_URLS.reale2014,
  },
  reid2019: { cite: "Reid et al. 2019, ApJ 885, 131" },
  reid2023: {
    cite: "Reid & Miller-Jones 2023, ApJ 959, 85 (GRS 1915+105: 9.4 kpc, 11.2 M☉)",
    link: SOURCE_URLS.reid2023,
  },
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
  rieutordRincon2010: {
    cite: "Rieutord & Rincon 2010, LRSP 7, 2 (the Sun's supergranulation: cells of ~30,000 km)",
    link: SOURCE_URLS.rieutordRincon2010,
  },
  riley2019: {
    cite: "Riley et al. 2019, ApJL 887, L21 (PSR J0030+0451 measured with NICER)",
    link: SOURCE_URLS.riley2019,
  },
  rygl2012: {
    cite: "Rygl et al. 2012, A&A 539, A79 (Cygnus X: 1.40 ± 0.08 kpc)",
    link: SOURCE_URLS.rygl2012,
  },
  sanders2024: { cite: "Sanders et al. 2024, MNRAS 530, 2972; Xiang & Rix 2022, Nature 603, 599" },
  schiller2008: { cite: "Schiller & Przybilla 2008, A&A 479, 849 (Deneb)" },
  schwabe1844: {
    cite: "Schwabe 1844, Astron. Nachr. 21, 233 (the sunspot period, announced in 1843 from the observations of 1826–1843)",
  },
  shemmer2004: {
    cite: "Shemmer et al. 2004, ApJ 614, 547 (Table 2: TON 618, log M/M☉ = 10.82)",
    link: SOURCE_URLS.shemmer2004,
  },
  silso: {
    cite: "WDC-SILSO, Royal Observatory of Belgium, Brussels (the sunspot number, version 2.0: Clette & Lefèvre 2016, Sol. Phys. 291, 2629)",
    link: SOURCE_URLS.silso,
  },
  simbad: {
    cite: "SIMBAD Astronomical Database, CDS Strasbourg (radial velocities as it adopts them)",
  },
  smith2006: {
    cite: "Smith 2006, ApJ 644, 1151 (the Carina Nebula's distance: 2.35 kpc)",
    link: SOURCE_URLS.smith2006,
  },
  snodgrass1990: {
    cite: "Snodgrass & Ulrich 1990, ApJ 351, 309 (the Sun's rotation from Doppler features, by latitude)",
    link: SOURCE_URLS.snodgrass1990,
  },
  solanki2003: {
    cite: "Solanki 2003, A&ARv 11, 153 (sunspots: umbral intensity and temperature, field strengths, sizes)",
    link: SOURCE_URLS.solanki2003,
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
  stenflo2012: {
    cite: "Stenflo & Kosovichev 2012, ApJ 745, 129 (Joy's law from MDI bipoles: tilt 32.1° sin φ, about half the latitude low down)",
    link: "https://doi.org/10.1088/0004-637X/745/2/129",
  },
  struble1999: {
    cite: "Struble & Rood 1999, ApJS 125, 35 (Perseus cz 5,366 km/s, as quoted by Penny et al. 2010)",
  },
  sunSpotGroups: {
    cite: "Spot groups located in the Sun Lab's SDO/HMI mosaic of 1–22 May 2024: the close-up stencil's spot mask, joined into groups and matched to the SWPC reports (scripts/locate-sun-spot-groups.mjs)",
  },
  swpcSrs: {
    cite: "NOAA/SWPC Joint USAF/NOAA Solar Region Summary, 1–22 May 2024 (NCEI archive: the regions with sunspots on the HMI discs the Sun's map is built from)",
    link: SOURCE_URLS.swpcSrs,
  },
  svalgaardSchatten2016: {
    cite: "Svalgaard & Schatten 2016, Sol. Phys. 291, 2653 (the sunspot group number by the backbone method, 1610 onwards)",
    link: SOURCE_URLS.svalgaardSchatten2016,
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
  usoskin2017: {
    cite: "Usoskin 2017, LRSP 14, 3 (grand minima and maxima of solar activity: the Dalton minimum ~1790–1830, the Modern grand maximum ~1940–2000)",
    link: "https://doi.org/10.1007/s41116-017-0006-9",
  },
  vallee2017: {
    cite: "Vallée 2017, Astron. Rev. 13, 113",
    link: SOURCE_URLS.vallee2017,
  },
  vanDerMarel2012: { cite: "van der Marel et al. 2012, ApJ 753, 8" },
  vanLeeuwen2007: { cite: "van Leeuwen 2007, A&A 474, 653 (Hipparcos, the new reduction)" },
  walker2018: {
    cite: "Walker et al. 2018, ApJ 855, 128 (M87's jet: ~17° from the line of sight)",
    link: SOURCE_URLS.walker2018,
  },
  wegg2015: {
    cite: "Wegg, Gerhard & Portail 2015, MNRAS 450, 4050",
    link: SOURCE_URLS.wegg2015,
  },
  wegner1993: { cite: "Wegner, Haynes & Giovanelli 1993, AJ 105, 1251 (the Perseus–Pisces ridge)" },
  wittkowski2012: { cite: "Wittkowski et al. 2012, A&A 540, L12 (VY Canis Majoris)" },
  wolf1852: {
    cite: "Wolf 1852, Mitt. Naturforsch. Ges. Bern (the relative sunspot number R = k (10 g + s), defined in 1848)",
  },
  woudt2008: {
    cite: "Woudt et al. 2008, MNRAS 383, 445 (the Norma cluster: 4,871 ± 54 km/s)",
    link: SOURCE_URLS.woudt2008,
  },
  zhang2001: {
    cite: "Zhang, Dere, Howard, Kundu & White 2001, ApJ 559, 452 (the three phases of a CME's kinematics: initiation below ~80 km/s, impulsive acceleration through the flare's rise, propagation)",
  },
  zhao2021: {
    cite: "Zhao et al. 2021, arXiv:2102.09093 (Cygnus X-1's spin > 0.9985 by continuum fitting)",
  },
  bergin2007: {
    cite: "Bergin & Tafalla 2007, Annual Review of Astronomy and Astrophysics 45, 339 (cold dark clouds: dense cores at 10⁴–10⁵ molecules per cm³)",
    link: "https://doi.org/10.1146/annurev.astro.45.071206.100404",
  },
  dunham2015: {
    cite: "Dunham et al. 2015, ApJS 220, 11 (young stellar objects in the Gould Belt: the Class 0 phase lasts 0.13–0.26 Myr)",
    link: "https://arxiv.org/abs/1508.03199",
  },
  gough1981: {
    cite: "Gough 1981, Solar Physics 74, 21 (the main-sequence Sun's luminosity by age, an interpolation of standard solar models)",
    link: "https://doi.org/10.1007/BF00151270",
  },
  feulner2012: {
    cite: "Feulner 2012, Reviews of Geophysics 50, RG2006 (the faint young Sun problem; Gough's law against standard models)",
    link: "https://doi.org/10.1029/2011RG000375",
  },
  kopparapu2013: {
    cite: "Kopparapu et al. 2013, ApJ 765, 131 (habitable zones around main-sequence stars; the Sun's conservative edges 0.99–1.70 au)",
    link: "https://doi.org/10.1088/0004-637X/765/2/131",
  },
  zwicky1933: {
    cite: "Zwicky 1933, Helv. Phys. Acta 6, 110 (Coma's missing mass)",
    link: SOURCE_URLS.zwicky1933,
  },
  williams2000: {
    cite: "Williams 2000, Reviews of Geophysics 38, 37 (the Elatina tidal rhythmites, 620 Myr ago: the Moon at 58.16 ± 0.30 Earth radii)",
    link: "https://doi.org/10.1029/1999RG900016",
  },
  meyers2018: {
    cite: "Meyers & Malinverno 2018, PNAS 115, 6363 (Milankovitch cycles in the Xiamaling Formation, 1.4 Gyr ago: the Moon 340,900 ± 2,600 km away, an 18.7 h day)",
    link: "https://doi.org/10.1073/pnas.1717689115",
  },
  lantink2022: {
    cite: "Lantink et al. 2022, PNAS 119, e2117146119 (Milankovitch cycles in the Joffre banded iron, 2.46 Gyr ago: the Moon 321,800 ± 6,500 km away, a 16.9 h day)",
    link: "https://doi.org/10.1073/pnas.2117146119",
  },
  eulenfeld2023: {
    cite: "Eulenfeld & Heubeck 2023, JGR Planets 128 (the Moodies Group's tidal bundles, 3.22 Gyr ago: the Moon at about 70 % of today's distance, a 13 h day)",
    link: "https://arxiv.org/abs/2207.05464",
  },
  salmonCanup2014: {
    cite: "Salmon & Canup 2014, Phil. Trans. R. Soc. A 372, 20130256 (the Moon accreted just outside the Roche limit, about 2.9 Earth radii)",
    link: "https://doi.org/10.1098/rsta.2013.0256",
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
