import { CREDIT_URLS, SOURCE_URLS } from "@horizon/toolkit/urls";

const specification = {
  schemaVersion: 1,
  features: ["bench", "stars", "lines", "mystery"],
  sections: [
    {
      id: "light",
      equations: [
        {
          equation: "planck-law",
        },
        {
          equation: "wien-displacement",
        },
        {
          equation: "photon-energy",
        },
      ],
    },
    {
      id: "atoms",
      equations: [
        {
          equation: "boltzmann-law",
        },
        {
          equation: "saha-equation",
        },
        "U(T) = Σ g_i e^(−E_i / kT), over NIST levels more than 1 eV below the limit",
        {
          equation: "rydberg-formula",
        },
      ],
    },
    {
      id: "bench",
      equations: [
        {
          equation: "slab-transfer",
        },
        {
          equation: "line-opacity",
        },
      ],
    },
    {
      id: "stars",
      equations: [
        "Δτ_k(λ) = κ_k(λ) Δm_k + Σ_lines n_k σ_k(λ) Δm_k",
        "κ(λ) = κ_H⁻ + κ_H,bf + κ_H,ff + σ_T nₑ / ρ + σ_R(λ) n_H / ρ",
        {
          equation: "eddington-flux",
        },
        {
          equation: "equivalent-width",
        },
      ],
    },
    {
      id: "shapes",
      equations: [
        {
          equation: "doppler-width",
        },
        "H(a, v) = (a / π) ∫ e^(−y²) / ((v − y)² + a²) dy",
        "γ₆ = γ₁₀₀₀₀ (T / 10⁴ K)^((1 − α)/2) n_H",
        "log γ₆ = 19.6 + ⅖ log C₆ + log P_g − 0.7 log T  (× 1.15)",
        "Δλ_Stark(Hβ) = 4.8 nm (nₑ / 10²³ m⁻³)^0.681",
      ],
    },
    {
      id: "motion",
      equations: [
        {
          equation: "doppler-shift",
        },
        "Δλ = λ / R",
        "λ_air = λ_vac / n(λ_vac)",
      ],
    },
    {
      id: "earth",
      equations: ["ν = ν₀ + B′N′(N′ + 1) − B″N″(N″ + 1),  N″ odd"],
    },
    {
      id: "limits",
      equations: [],
    },
  ],
  references: [
    {
      title: "Kramida, Ralchenko, Reader & NIST ASD Team, NIST Atomic Spectra Database (version 5)",
      url: CREDIT_URLS.nistAsd,
    },
    {
      title:
        "Castelli & Kurucz (2003), New grids of ATLAS9 model atmospheres, IAU Symposium 210, A20",
      url: SOURCE_URLS.castelli2003,
    },
    {
      title:
        "Asplund, Grevesse, Sauval & Scott (2009), The chemical composition of the Sun, ARA&A 47, 481",
      url: SOURCE_URLS.asplund2009,
    },
    {
      title: "Grevesse & Sauval (1998), Standard solar composition, Space Science Reviews 85, 161",
      url: SOURCE_URLS.grevesse1998,
    },
    {
      title:
        "Pecaut & Mamajek (2013), Intrinsic colors, temperatures, and bolometric corrections of pre-main-sequence stars, ApJS 208, 9",
      url: SOURCE_URLS.pecaut2013,
    },
    {
      title:
        "Gray (2005), The Observation and Analysis of Stellar Photospheres, 3rd ed., Cambridge University Press",
      url: SOURCE_URLS.gray2005,
    },
    {
      title: "Carroll & Ostlie (2017), An Introduction to Modern Astrophysics, 2nd ed., ch. 8–9",
      url: SOURCE_URLS.carroll2017,
    },
    {
      title:
        "John (1988), Continuous absorption by the negative hydrogen ion reconsidered, A&A 193, 189",
      url: SOURCE_URLS.john1988,
    },
    {
      title:
        "Barklem, Piskunov & O'Mara (2000), A list of data for the broadening of metallic lines by neutral hydrogen collisions, A&AS 142, 467",
      url: SOURCE_URLS.barklem2000,
    },
    {
      title:
        "Humlíček (1982), Optimized computation of the Voigt and complex probability functions, JQSRT 27, 437",
      url: SOURCE_URLS.humlicek1982,
    },
    {
      title:
        "Gigosos, González & Cardeñoso (2003), Computer simulated Balmer-alpha, -beta and -gamma Stark line profiles, Spectrochimica Acta B 58, 1489",
      url: SOURCE_URLS.gigosos2003,
    },
    {
      title:
        "Morton (2000), Atomic data for resonance absorption lines. II, ApJS 130, 403 (air wavelengths)",
      url: SOURCE_URLS.morton2000,
    },
    {
      title:
        "CIE (2019), CIE 1931 colour-matching functions, 2 degree observer (CIE 018:2019 dataset)",
      url: CREDIT_URLS.cie,
    },
    {
      title:
        "Babcock & Herzberg (1948), Fine structure of the red system of atmospheric oxygen bands, ApJ 108, 167",
      url: SOURCE_URLS.babcock1948,
    },
    {
      title:
        "Gordon et al. (2022), The HITRAN2020 molecular spectroscopic database, JQSRT 277, 107949",
      url: SOURCE_URLS.gordon2022,
    },
    {
      title: "Saha (1920), Ionization in the solar chromosphere, Philosophical Magazine 40, 472",
      url: SOURCE_URLS.saha1920,
    },
    {
      title: "Payne (1925), Stellar Atmospheres, Harvard Observatory Monographs 1",
      url: SOURCE_URLS.payne1925,
    },
    {
      title:
        "Kirchhoff (1860), Ueber das Verhältniss zwischen dem Emissionsvermögen und dem Absorptionsvermögen der Körper für Wärme und Licht, Annalen der Physik 185, 275",
      url: SOURCE_URLS.kirchhoff1860,
    },
    {
      title:
        "Hummel et al. (2013), Dynamical mass of the O-type supergiant in ζ Orionis A, A&A 554, A52",
      url: SOURCE_URLS.hummel2013,
    },
    {
      title:
        "Moravveji et al. (2012), Asteroseismology of the nearby SN-II progenitor Rigel, ApJ 747, 108",
      url: SOURCE_URLS.moravveji2012,
    },
    {
      title: "Castelli & Kurucz (1994), Model atmospheres for Vega, A&A 281, 817",
      url: SOURCE_URLS.castelli1994,
    },
    {
      title:
        "Kervella et al. (2004), The diameter and evolutionary state of Procyon A, A&A 413, 251",
      url: SOURCE_URLS.kervella2004,
    },
    {
      title:
        "Ramírez & Allende Prieto (2011), Fundamental parameters and chemical composition of Arcturus, ApJ 743, 135",
      url: SOURCE_URLS.ramirez2011,
    },
    {
      title:
        "Heiter et al. (2015), Gaia FGK benchmark stars: effective temperatures and surface gravities, A&A 582, A49",
      url: SOURCE_URLS.heiter2015,
    },
  ],
};

export default specification;
