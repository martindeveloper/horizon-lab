import { CREDIT_URLS, SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["views", "controls", "learning"],
  sections: [
    {
      id: "rays",
      equations: [
        "u = 1/r; c = a(aE − L); K = Q + (L − aE)²; dλ = dλ_affine / Σ",
        "(du/dλ)² = (E + cu²)² − K(u² − 2u³ + a²u⁴); d²u/dλ² = 2cu(E + cu²) − Ku(1 − 3u + 2a²u²)",
        "d²s/dλ² = −(Q + L² + a²E² cos²θ) s + a²E² cosθ (ŷ − cosθ s); s = (sinθ cosφ, cosθ, sinθ sinφ)",
        "(dφ/dλ)_drag = a u (2E − aLu) / (1 − 2u + a²u²)",
        "camera (ZAMO): L = ϖ n_φ, E = α + ωL, p_θ = √Σ n_θ; g_sky = 1/E",
      ],
    },
    {
      id: "radii",
      equations: [
        {
          equation: "schwarzschild-radius",
        },
        {
          equation: "kerr-horizon",
        },
        {
          equation: "photon-orbit",
        },
        {
          equation: "isco",
        },
        {
          equation: "kerr-orbital-period",
        },
      ],
    },
    {
      id: "disk",
      equations: [
        {
          equation: "kerr-angular-velocity",
        },
        {
          equation: "circular-orbit-energy",
        },
        {
          equation: "circular-orbit-momentum",
        },
        "F(r) ∝ −Ω′ / [r(E − ΩL)²] ∫(E − ΩL) dL",
        {
          equation: "disk-redshift",
        },
        {
          equation: "disk-temperature",
        },
        "I ∝ F/F_peak × texture × I(μ) × g⁴",
        {
          equation: "limb-darkening",
        },
        {
          equation: "emission-angle",
        },
      ],
    },
    {
      id: "clocks",
      equations: [
        {
          equation: "rain-clock-rate",
        },
        {
          equation: "rain-fall-speed",
        },
      ],
    },
    {
      id: "performance",
      equations: [],
    },
    {
      id: "limits",
      equations: [],
    },
  ],
  references: [
    {
      title: "Bardeen, Press & Teukolsky (1972) · Kerr circular orbits",
      url: SOURCE_URLS.bardeen1972,
    },
    {
      title: "Page & Thorne (1974) · Thin-disk flux",
      url: SOURCE_URLS.page1974,
    },
    {
      title: "Narayan, Johnson & Gammie (2019) · Shadow and critical curve",
      url: SOURCE_URLS.narayan2019,
    },
    {
      title: "Mino (2003) · Separated Kerr geodesics in Mino time",
      url: SOURCE_URLS.mino2003,
    },
    {
      title: "Cunningham (1975) · Disk light in Kerr, plunging-region shifts",
      url: SOURCE_URLS.cunningham1975,
    },
    {
      title: "GRAVITY Collaboration (2022) · Sgr A* mass and distance",
      url: SOURCE_URLS.gravity2022Article,
    },
    {
      title: "EHT Collaboration (2025) · M87* ring measurements",
      url: SOURCE_URLS.eht2025Arxiv,
    },
    {
      title: "Miller-Jones et al. (2021) · Cygnus X-1 mass",
      url: SOURCE_URLS.millerJones2021Arxiv,
    },
    {
      title: "Ramachandran et al. (2025) · Cygnus X-1 companion and mass estimates",
      url: SOURCE_URLS.ramachandran2025,
    },
    {
      title: "Chandrasekhar (1960) · Radiative Transfer, limb darkening",
      url: SOURCE_URLS.chandrasekhar1960,
    },
    {
      title: "CIE (1931) · Colour-matching functions, 2° observer",
      url: CREDIT_URLS.cie,
    },
    {
      title: "NASA · Lensed disks and Doppler contrast",
      url: SOURCE_URLS.nasaBlackHoleVisualization,
    },
  ],
};

export default specification;
