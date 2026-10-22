import { CREDIT_URLS, SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["scale", "flight", "clocks", "light", "sky"],
  sections: [
    {
      id: "scale",
      equations: [
        "x_body(t) = Kepler(JPL elements, t) · au,  x_Earth = x_EMB − μ x_Moon,  μ = m_Moon / (M_Earth + m_Moon)",
        {
          equation: "kepler-third-law",
        },
      ],
    },
    {
      id: "flight",
      equations: [
        {
          equation: "torch-trip",
        },
        "t_coast = D / v,  τ = t / γ",
        "a_grav = Σ GM_i (x_i − x) / |x_i − x|³,  h ≤ √(r³ / GM) / 40",
        {
          equation: "lorentz-factor",
        },
        {
          equation: "time-dilation",
        },
      ],
    },
    {
      id: "light",
      equations: [
        {
          equation: "solar-irradiance",
        },
        {
          equation: "light-travel-time",
        },
        "shadow = Π [1 − k² (1 − smoothstep(|ρ_body − ρ_sun|, ρ_body + ρ_sun, θ))],  k = min(ρ_body / ρ_sun, 1),  ρ = R / d",
      ],
    },
    {
      id: "sky",
      equations: [
        "x_star = d · n̂ − x_ship,  d = 1000 / ϖ pc (SIMBAD parallax ϖ, mas)",
        "x_B − x_A = Thiele–Innes(P = 79.91 yr, e = 0.518, a = 17.57″ d, i = 79.2°, ω, Ω),  I(μ)/I(1) = 0.4 + 0.6 μ",
        "n̂′ = (n̂ + v̂ ((γ − 1) n̂·v̂ + γβ)) / (γ (1 + β n̂·v̂))",
        "a globe: n̂′ as above, θ′ = θ / D (Penrose 1959, Terrell 1959: a sphere's outline stays a circle)",
        {
          equation: "relativistic-doppler",
        },
        "T′ = D T,  F′ = D² F (a star),  I′ = D⁴ I (the band, the background),  T = 4600 K (1/(0.92 (B−V) + 1.7) + 1/(0.92 (B−V) + 0.62))",
        {
          equation: "rapidity",
        },
      ],
    },
  ],
  references: [
    {
      title:
        "Standish & Williams, Keplerian elements for approximate positions of the major planets (JPL Solar System Dynamics)",
      url: SOURCE_URLS.jplElements,
    },
    {
      title:
        "Archinal et al. (2018), Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015, CMDA 130, 22",
      url: CREDIT_URLS.iau,
    },
    {
      title: "JPL Solar System Dynamics, Planetary satellite mean orbital parameters",
      url: SOURCE_URLS.jplSatElements,
    },
    {
      title: "Ballesteros (2012), New insights into black bodies, EPL 97, 34008",
      url: SOURCE_URLS.ballesteros2012,
    },
    {
      title: "van Leeuwen (2007), Validation of the new Hipparcos reduction, A&A 474, 653",
      url: SOURCE_URLS.vanLeeuwen2007,
    },
    {
      title:
        "Kopp & Lean (2011), A new, lower value of total solar irradiance: evidence and climate significance, GRL 38, L01706",
      url: SOURCE_URLS.kopp2011,
    },
    {
      title:
        "Brozović et al. (2015), The orbits and masses of satellites of Pluto, Icarus 246, 317",
      url: SOURCE_URLS.brozovic2015,
    },
    {
      title:
        "Rindler (2006), Relativity: Special, General, and Cosmological, 2nd ed., Oxford University Press (hyperbolic motion)",
      url: SOURCE_URLS.rindler2006,
    },
    {
      title: "JPL, Voyager mission status",
      url: SOURCE_URLS.nasaVoyagerStatus,
    },
    {
      title:
        "Pourbaix et al. (2002), Constraining the difference in convective blueshift between the components of α Centauri with precise radial velocities, A&A 386, 280",
      url: SOURCE_URLS.pourbaix2002,
    },
    {
      title:
        "Kervella et al. (2017), The radii and limb darkenings of α Centauri A and B, A&A 597, A137",
      url: SOURCE_URLS.kervella2017Radii,
    },
    {
      title: "Kervella et al. (2017), Proxima's orbit around α Centauri, A&A 598, L7",
      url: SOURCE_URLS.kervella2017,
    },
    {
      title:
        "Mann et al. (2015), How to constrain your M dwarf: measuring effective temperature, bolometric luminosity, mass, and radius, ApJ 804, 64",
      url: SOURCE_URLS.mann2015,
    },
    {
      title:
        "Ségransan et al. (2003), First radius measurements of very low mass stars with the VLTI, A&A 397, L5",
      url: SOURCE_URLS.segransan2003,
    },
    {
      title: "Gaia Collaboration (2023), Gaia Data Release 3, A&A 674, A1",
      url: SOURCE_URLS.gaia2023,
    },
    {
      title:
        "Planck Collaboration (2020), Planck 2018 results. VI. Cosmological parameters, A&A 641, A6",
      url: CREDIT_URLS.planck,
    },
    {
      title: "Fixsen (2009), The temperature of the cosmic microwave background, ApJ 707, 916",
      url: SOURCE_URLS.fixsen2009Doi,
    },
    {
      title:
        "Chapront-Touzé & Chapront (1983), The lunar ephemeris ELP 2000, A&A 124, 50; truncated as in Meeus (1998), Astronomical Algorithms, ch. 47",
      url: SOURCE_URLS.chaprontTouze1983,
    },
    {
      title:
        "Terrell (1959), Invisibility of the Lorentz contraction, Phys. Rev. 116, 1041; Penrose (1959), Proc. Camb. Phil. Soc. 55, 137",
      url: SOURCE_URLS.terrell1959,
    },
  ],
};

export default specification;
