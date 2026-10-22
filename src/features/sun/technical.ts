import { SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["views", "interior", "surface", "atmosphere", "field", "lights", "cycle"],
  sections: [
    {
      id: "interior",
      equations: [
        {
          equation: "hydrostatic-equilibrium",
        },
        {
          equation: "pp-chain-energy",
        },
        {
          equation: "mass-loss-rate",
        },
        {
          equation: "photon-diffusion-time",
        },
      ],
    },
    {
      id: "rotation",
      equations: [
        {
          equation: "differential-rotation",
        },
      ],
    },
    {
      id: "surface",
      equations: [
        {
          equation: "scale-height",
        },
        "I(μ)/I(1) = 1 − Σₙ aₙ (1 − μⁿ⸍²)",
        {
          equation: "mean-density",
        },
      ],
    },
    {
      id: "atmosphere",
      equations: ["K(ρ) ∝ 0.0532 ρ^−2.5 + 1.425 ρ^−7 + 2.565 ρ^−17"],
    },
    {
      id: "field",
      equations: [
        "∇ × B_bg = 0,  B_bg = −∇Φ  (r ≤ R_ss)",
        "B = (∂A/∂y, −∂A/∂x, 0),  ∇ · B = 0",
        "E_z = −∂A/∂s,  ∂A/∂s + v · ∇A = −η J_z",
        {
          equation: "alfven-speed",
        },
        {
          equation: "reconnection-energy",
        },
        {
          equation: "goes-class",
        },
      ],
    },
    {
      id: "lights",
      equations: ["R_display(T) = Σᵢ wᵢ exp(−(log T − log Tᵢ)² / 2σᵢ²)"],
    },
    {
      id: "cycle",
      equations: [
        {
          equation: "wolf-number",
        },
      ],
    },
    {
      id: "limits",
      equations: [],
    },
  ],
  references: [
    {
      title: "Christensen-Dalsgaard et al. 1996, Science 272, 1286 (Model S: the Sun's interior)",
      url: SOURCE_URLS.christensenDalsgaard1996,
    },
    {
      title: "Snodgrass & Ulrich 1990, ApJ 351, 309 (the Sun's rotation by latitude)",
      url: SOURCE_URLS.snodgrass1990,
    },
    {
      title: "Lemen et al. 2012, Solar Physics 275, 17 (the AIA passbands)",
      url: SOURCE_URLS.lemen2012,
    },
    {
      title:
        "Pontin & Priest 2022, Living Reviews in Solar Physics 19, 1 (magnetic induction, flux transfer and reconnection)",
      url: SOURCE_URLS.pontin2022,
    },
    {
      title:
        "Aulanier & Dudík 2019, A&A 621, A72 (anchored flux ropes and flare-loop reconnection)",
      url: SOURCE_URLS.aulanier2019,
    },
    {
      title: "Hathaway 2015, Living Reviews in Solar Physics 12, 4 (the solar cycle)",
      url: SOURCE_URLS.hathaway2015,
    },
    {
      title: "Solanki 2003, A&ARv 11, 153 (sunspots)",
      url: SOURCE_URLS.solanki2003,
    },
    {
      title: "Nordlund, Stein & Asplund 2009, Living Reviews in Solar Physics 6, 2 (granulation)",
      url: SOURCE_URLS.nordlund2009,
    },
    {
      title: "WDC-SILSO, Royal Observatory of Belgium (sunspot numbers since 1700)",
      url: SOURCE_URLS.silsoHome,
    },
    {
      title: "NIST isotope tables (neutral hydrogen-1 and helium-4 atomic masses)",
      url: SOURCE_URLS.nistIsotopeMasses,
    },
    {
      title:
        "Mitalas & Sills 1992, ApJ 401, 759 (shell diffusion estimate, equation 9; convection boundary)",
      url: SOURCE_URLS.mitalasSills1992,
    },
    {
      title: "Boerner et al. 2013 (AIA thermal response and calibration)",
      url: SOURCE_URLS.boerner2013,
    },
    {
      title:
        "Shestov et al. 2025, A&A 699, A7 (EUI/AIA cross-calibration and emission-measure analysis)",
      url: SOURCE_URLS.shestov2025,
    },
    {
      title:
        "Golding et al. 2017, A&A 597, A102 (helium non-equilibrium ionization and optically thick transfer)",
      url: SOURCE_URLS.golding2017,
    },
    {
      title: "Vasil et al. 2024, Nature (a near-surface dynamo hypothesis)",
      url: SOURCE_URLS.vasil2024,
    },
    {
      title:
        "Mandal & Kosovichev 2026, Scientific Reports (helioseismic evidence for deep dynamo activity)",
      url: SOURCE_URLS.mandal2026,
    },
    {
      title:
        "Bale et al. 2023, Nature (Parker observations supporting interchange reconnection in fast-wind sources)",
      url: SOURCE_URLS.bale2023,
    },
    {
      title:
        "Joshi et al. 2025, A&A 698, A301 (observed three-dimensional reconnection and changing CME footpoints)",
      url: SOURCE_URLS.joshi2025,
    },
    {
      title: "NOAA SWPC glossary (GOES peak soft X-ray classification)",
      url: SOURCE_URLS.swpcGlossary,
    },
    {
      title: "NASA Parker Solar Probe (mission history and closest approach)",
      url: SOURCE_URLS.nasaParker,
    },
  ],
};

export default specification;
