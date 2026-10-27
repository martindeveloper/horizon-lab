import { CREDIT_URLS, SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["ladder", "figures", "surfaces", "weather", "horizons"],
  sections: [
    {
      id: "ladder",
      equations: [
        "s(t) = s_i (s_{i+1} / s_i)^f,  t = i + f",
        "x(t) = x_i + (x_{i+1} − x_i) (s(t) − s_i) / (s_{i+1} − s_i)",
      ],
    },
    {
      id: "sizes",
      equations: ["R = θ d / 2"],
    },
    {
      id: "light",
      equations: [
        {
          equation: "stefan-boltzmann",
        },
        {
          equation: "light-lap",
        },
      ],
    },
    {
      id: "surfaces",
      equations: [
        "I(μ)/I(1) = 1 − Σₙ₌₁⁴ aₙ (1 − μⁿ⸍²)",
        "F = σT⁴,   ∫ F dA = L",
        "gᵣ = −GM/r² + Ω²r sin²θ",
        {
          equation: "scale-height",
        },
        {
          equation: "granules-across",
        },
      ],
    },
    {
      id: "weather",
      equations: [
        "Ω(φ) = Ω₀ (1 − k sin² φ)",
        "L(t) ∝ (1 − e^(−t/τᵣ)) e^(−t/τ_d)",
        {
          equation: "baumbach-corona",
        },
      ],
    },
    {
      id: "matter",
      equations: [
        {
          equation: "spheroid-density",
        },
      ],
    },
    {
      id: "horizons",
      equations: [
        {
          equation: "schwarzschild-radius",
        },
        {
          equation: "photon-sphere",
        },
        {
          equation: "critical-impact",
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
      title: "IAU 2015 Resolution B3: nominal solar and planetary conversion constants",
      url: CREDIT_URLS.iauUnits,
    },
    {
      title: "Joyce et al. (2020), Standing on the shoulders of giants: Betelgeuse, ApJ 902, 63",
      url: SOURCE_URLS.joyce2020,
    },
    {
      title: "Riley et al. (2019), A NICER view of PSR J0030+0451, ApJL 887, L21",
      url: SOURCE_URLS.riley2019,
    },
    {
      title:
        "Event Horizon Telescope Collaboration (2019), Paper VI: the shadow and mass of M87*, ApJL 875, L6",
      url: SOURCE_URLS.eht2019,
    },
    {
      title:
        "Schwarzschild (1975), On the scale of photospheric convection in red giants and supergiants, ApJ 195, 137",
      url: SOURCE_URLS.schwarzschild1975,
    },
    {
      title:
        "Baumbach (1937), Strahlung, Ergiebigkeit und Elektronendichte der Sonnenkorona, AN 263, 121",
      url: SOURCE_URLS.baumbach1937,
    },
    {
      title:
        "Snodgrass & Ulrich (1990), Rotation of Doppler features in the solar photosphere, ApJ 351, 309",
      url: SOURCE_URLS.snodgrass1990Ads,
    },
    {
      title: "Hale et al. (1919), The magnetic polarity of sun-spots, ApJ 49, 153",
      url: SOURCE_URLS.hale1919,
    },
    {
      title:
        "Linsky & Haisch (1979), Outer atmospheres of cool stars: the sharp division into solar-type and non-solar-type stars, ApJ 229, L27",
      url: SOURCE_URLS.linsky1979,
    },
    {
      title:
        "Montargès et al. (2021), A dusty veil shading Betelgeuse during its Great Dimming, Nature 594, 365",
      url: SOURCE_URLS.montarges2021,
    },
    {
      title:
        "Burrows et al. (2001), The theory of brown dwarfs and extrasolar giant planets, Rev. Mod. Phys. 73, 719",
      url: SOURCE_URLS.burrows2001,
    },
    {
      title:
        "Healy et al. (2024), Red Supergiant Candidates for Multimessenger Monitoring, MNRAS 529, 3630",
      url: SOURCE_URLS.healy2024Paper,
    },
    {
      title: "Healy et al., accompanying catalogue dated 2024-04-11 (UY Sct row)",
      url: SOURCE_URLS.healy2024,
    },
    {
      title: "Gralla, Holz & Wald (2019), Black Hole Shadows, Photon Rings, and Lensing Rings",
      url: SOURCE_URLS.gralla2019,
    },
    {
      title: "Visser (2007), The Kerr spacetime: A brief introduction",
      url: SOURCE_URLS.visser2007,
    },
    {
      title: "Domiciano de Souza et al. (2014), The environment of the fast rotating star Achernar",
      url: SOURCE_URLS.domiciano2014,
    },
    {
      title: "Brinkman et al. (2000), First Light Measurements of Capella with Chandra LETGS",
      url: SOURCE_URLS.brinkman2000,
    },
    {
      title:
        "Claret & Bloemen (2011), atmosphere limb-darkening coefficients, corrected CDS tables",
      url: SOURCE_URLS.claretBloemen2011,
    },
    {
      title: "Espinosa Lara & Rieutord (2011), Gravity darkening in rotating stars",
      url: SOURCE_URLS.espinosaLara2011,
    },
    {
      title:
        "Monnier et al. (2012), Resolving Vega and the inclination controversy with CHARA/MIRC",
      url: SOURCE_URLS.monnier2012,
    },
    {
      title:
        "Chiavassa et al. (2011), Radiative hydrodynamic simulations of red supergiant stars III",
      url: SOURCE_URLS.chiavassa2011,
    },
    {
      title:
        "NSO (2020), Inouye Solar Telescope first-light granulation and magnetic bright points",
      url: SOURCE_URLS.nso2020,
    },
    {
      title:
        "Dupree et al. (2022), The Great Dimming of Betelgeuse: a Surface Mass Ejection and Its Consequences",
      url: SOURCE_URLS.dupree2022,
    },
    {
      title:
        "Chiavassa et al. (2010), Red-supergiant convection simulations compared with Betelgeuse interferometry",
      url: SOURCE_URLS.chiavassa2010,
    },
    {
      title:
        "Mathur et al. (2011), Granulation in Red Giants: observations by the Kepler mission and 3D convection simulations",
      url: SOURCE_URLS.mathur2011,
    },
  ],
};

export default specification;
