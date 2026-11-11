/** App-owned URLs. Keep this module dependency-free for metadata, scripts and error pages. */
export const PAGE_URLS = {
  home: "/",
  about: "/about",
  credits: "/credits",
  changelog: "/changelog",
  sitemap: "/sitemap.xml",
  version: "/version.json",
  debugNotFound: "/horizon-debug-not-found",
} as const;

export const SIMULATION_PREFIX = "/lab";
export const EXPERIENCE_PREFIX = "/experience";

export const PUBLIC_ASSETS = {
  favicon: "/favicon.svg",
  faviconIco: "/favicon.ico",
  appleIcon: "/apple-touch-icon.png",
  icon192: "/icons/icon-192.png",
  icon512: "/icons/icon-512.png",
  social: "/social/horizon.png",
} as const;

export const simulationAssets = <const Id extends string>(id: Id) => ({
  artwork: `/simulations/${id}.svg` as const,
  social: `/simulations/${id}/og.png` as const,
});

export const MAPS_KEY = "/textures/bodies";

/** Bucket folder of the built spacecraft models: `<key>/<id>/v<version>/<id>.glb`. */
export const MODELS_KEY = "/models/spacecraft";

const audioAssets = <const Id extends string>(id: Id) => ({
  opus: `/audio/${id}.webm` as const,
  aac: `/audio/${id}.m4a` as const,
  map: `/audio/${id}.map.json` as const,
});

export const AUDIO_ASSETS = {
  interstellarDrift: audioAssets("interstellar-drift"),
  aeolianStatic: audioAssets("aeolian-static"),
  driftingProbe: audioAssets("drifting-probe"),
  lowDroneRises: audioAssets("low-drone-rises"),
  vastEmptySpace: audioAssets("vast-empty-space"),
  theStarRings: audioAssets("the-star-rings"),
  theLastBreath: audioAssets("the-last-breath"),
} as const;

export const ANCHOR_IDS = { mainContent: "main-content" } as const;
export const FRAGMENT_URLS = { mainContent: `#${ANCHOR_IDS.mainContent}` } as const;

export const CREDIT_ANCHORS = {
  imagery: "credits-imagery",
  data: "credits-data",
  fonts: "credits-fonts",
  software: "credits-software",
  tools: "credits-tools",
  "map-details": "credits-map-details",
  "source-details": "credits-source-details",
  "licence-texts": "credits-licence-texts",
} as const;

export function creditFragment(section: keyof typeof CREDIT_ANCHORS) {
  return `#${CREDIT_ANCHORS[section]}` as const;
}

export function creditUrl(section: keyof typeof CREDIT_ANCHORS) {
  return `${PAGE_URLS.credits}${creditFragment(section)}` as const;
}

/** Historical public addresses retained as permanent redirects. */
export const LEGACY_URLS = {
  mapCredits: "/textures/orrery/CREDITS.md",
  scientificSources: "/SCIENTIFIC-SOURCES.txt",
  thirdPartyNotices: "/THIRD-PARTY-NOTICES.txt",
} as const;

export const EXTERNAL_URLS = {
  astronomyCourse:
    "https://www.planetum.cz/eshop/produkt/1115-astronomicky-kurz-2026-27-i-rocnik-prezencni",
} as const;

/** Production defaults; config.ts applies environment overrides. */
export const DEPLOYMENT_URLS = {
  cdn: "https://cdn.horizonlab.observer",
  repository: "https://github.com/martindeveloper/horizon-lab",
  site: "https://horizon.martinpernica.xyz",
} as const;
