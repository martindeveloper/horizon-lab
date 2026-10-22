import { CREDIT_URLS, SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["views", "time", "bodies"],
  sections: [
    {
      id: "ephemeris",
      equations: [
        {
          equation: "secular-element",
        },
        {
          equation: "argument-of-perihelion",
        },
        {
          equation: "mean-anomaly",
        },
        {
          equation: "kepler-equation",
        },
        {
          equation: "perifocal-x",
        },
        {
          equation: "perifocal-y",
        },
        {
          equation: "kepler-third-law",
        },
      ],
    },
    {
      id: "migration",
      equations: [
        {
          equation: "gas-disk",
        },
        {
          equation: "migration-progress",
        },
        {
          equation: "migrated-element",
        },
        {
          equation: "tracer-semi-major-axis",
        },
      ],
    },
    {
      id: "sky",
      equations: [
        "x_ecl = x_eq, y_ecl = cos ε y_eq + sin ε z_eq, z_ecl = −sin ε y_eq + cos ε z_eq  (ε = 23.439°)",
        "ĉ(t) = ĉ₀ cos θ + (p̂ × ĉ₀) sin θ",
        {
          equation: "galactic-angle",
        },
      ],
    },
    {
      id: "swarms",
      equations: [
        "E − e sin E = M, four Newton steps in the vertex shader",
        "L_Trojan = L_Jupiter ± 60° + δ",
        "n(r) ∝ r⁻³·⁵, r sampled by inverting ∫ r² n(r) dr",
      ],
    },
    {
      id: "globes",
      equations: [
        "I = μ₀ᵏ μᵏ⁻¹  (Minnaert; k ≈ 0.6 regolith, ≈ 0.95 cloud-topped giants)",
        "I(μ)/I(1) = 1 − u(1 − μ) − v(1 − μ²)  (solar limb darkening per colour)",
        "α = 1 − e^(−τ/μ);  lit face ∝ μ₀/(μ + μ₀)·(1 − e^(−τ(1/μ + 1/μ₀)))",
      ],
    },
    {
      id: "observatories",
      equations: [
        {
          equation: "mean-motion-axis",
        },
        {
          equation: "j2-nodal-regression",
        },
        {
          equation: "j2-apsidal-precession",
        },
        {
          equation: "second-lagrange-point",
        },
      ],
    },
    {
      id: "rendering",
      equations: [],
    },
  ],
  references: [
    {
      title:
        "JPL Solar System Dynamics: Keplerian elements for approximate positions of the major planets",
      url: SOURCE_URLS.jplElements,
    },
    {
      title:
        "Tsiganis, Gomes, Morbidelli & Levison (2005), Origin of the orbital architecture of the giant planets of the Solar System, Nature 435, 459",
      url: SOURCE_URLS.tsiganis2005,
    },
    {
      title: "Nesvorný (2018), Dynamical evolution of the early Solar System, ARA&A 56, 137",
      url: SOURCE_URLS.nesvorny2018,
    },
    {
      title:
        "Avdellidou et al. (2024), Dating the Solar System's giant planet orbital instability using enstatite meteorites, Science 384, 348",
      url: SOURCE_URLS.avdellidou2024,
    },
    {
      title: "NASA Science: Kuiper Belt facts",
      url: SOURCE_URLS.nasaKuiper,
    },
    {
      title: "NASA Science: Oort Cloud facts",
      url: SOURCE_URLS.nasaOortCloud,
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
        "Xiang & Rix (2022), A time-resolved picture of our Milky Way's early formation history, Nature 603, 599",
      url: SOURCE_URLS.xiang2022,
    },
    {
      title:
        "Sanders et al. (2024), The epoch of the Milky Way's bar formation: dynamical modelling of Mira variables in the nuclear stellar disc, MNRAS 530, 2972",
      url: SOURCE_URLS.sanders2024,
    },
    {
      title:
        "Malhotra (1995), The origin of Pluto's orbit: implications for the Solar System beyond Neptune, AJ 110, 420",
      url: SOURCE_URLS.malhotra1995,
    },
    {
      title:
        "Nesvorný, Vokrouhlický, Bottke & Levison (2018), Evidence for very early migration of the Solar System planets from the Patroclus–Menoetius binary Jupiter Trojan, Nature Astronomy 2, 878",
      url: SOURCE_URLS.nesvorny2018Neptune,
    },
    {
      title:
        "Nesvorný, Vokrouhlický & Morbidelli (2013), Capture of Trojans by jumping Jupiter, ApJ 768, 45",
      url: SOURCE_URLS.nesvorny2013,
    },
    {
      title:
        "Duncan, Quinn & Tremaine (1987), The formation and extent of the Solar System comet cloud, AJ 94, 1330",
      url: SOURCE_URLS.duncan1987,
    },
    {
      title: "Kokubo & Ida (1998), Oligarchic growth of protoplanets, Icarus 131, 171",
      url: SOURCE_URLS.kokubo1998,
    },
    {
      title:
        "Gomes, Levison, Tsiganis & Morbidelli (2005), Origin of the cataclysmic Late Heavy Bombardment period of the terrestrial planets, Nature 435, 466",
      url: SOURCE_URLS.gomes2005,
    },
    {
      title:
        "Archinal et al. (2018), Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015, Celest. Mech. Dyn. Astron. 130, 22",
      url: CREDIT_URLS.iau,
    },
    {
      title: "NASA NSSDC planetary fact sheets and ring fact sheets (Saturn, Uranus, Neptune)",
      url: CREDIT_URLS.nssdc,
    },
    {
      title: "PDS Ring-Moon Systems Node: ring tables for Saturn, Uranus and Neptune",
      url: SOURCE_URLS.pdsSaturnRings,
    },
    {
      title:
        "French et al. (2024), The Uranus system from occultation observations (1977–2006), Icarus",
      url: SOURCE_URLS.french2024,
    },
    {
      title:
        "Irwin et al. (2024), Modelling the seasonal cycle of Uranus's colour and magnitude, and comparison with Neptune, MNRAS 527, 11521",
      url: SOURCE_URLS.irwin2024,
    },
    {
      title:
        "Lamy et al. (2025), A new rotation period and longitude system for Uranus, Nature Astronomy 9, 658",
      url: SOURCE_URLS.lamy2025,
    },
    {
      title:
        "Simon et al. (2018), Historical and contemporary trends in the size, drift and color of Jupiter's Great Red Spot, AJ 155, 151",
      url: SOURCE_URLS.simon2018,
    },
    {
      title:
        "Hubble OPAL global maps of Jupiter, Saturn, Uranus and Neptune, 2025 (NASA, ESA, A.A. Simon, M.H. Wong; CC BY 4.0; programme GO13937), DOI 10.17909/T9G593",
      url: SOURCE_URLS.opalDoi,
    },
    {
      title: "NASA Earth Observatory, Blue Marble Next Generation (October) and Blue Marble clouds",
      url: CREDIT_URLS.blueMarble,
    },
    {
      title: "USGS Astrogeology, Mars Viking global colour mosaic 925 m",
      url: CREDIT_URLS.viking,
    },
    {
      title: "USGS Astrogeology, Mercury MESSENGER MDIS basemap 3-colour global mosaic 665 m",
      url: CREDIT_URLS.messenger,
    },
    {
      title: "USGS, Pluto global mosaic from New Horizons, July 2017 (NASA, JHU APL, SwRI, LPI)",
      url: CREDIT_URLS.newHorizons,
    },
    {
      title:
        "CelesTrak, GP element sets: Hubble Space Telescope (NORAD 20580) and Chandra X-ray Observatory (25867)",
      url: SOURCE_URLS.celestrakGp,
    },
    {
      title:
        "JPL Horizons: James Webb Space Telescope (-170), Goddard FDF reconstructed and predicted trajectory",
      url: SOURCE_URLS.horizonsWebb,
    },
    {
      title: "NASA Science: Webb fact sheet",
      url: SOURCE_URLS.nasaWebbFacts,
    },
    {
      title: "Chandra X-ray Center: Chandra specifications",
      url: SOURCE_URLS.cxcSpecs,
    },
    {
      title: "NASA 3D Resources: Hubble, Chandra and James Webb Space Telescope models (NASA VTAD)",
      url: CREDIT_URLS.nasa3d,
    },
  ],
};

export default specification;
