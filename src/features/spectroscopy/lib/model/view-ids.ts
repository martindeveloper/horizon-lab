/** Stellar Spectra's views, in the order the guide walks them. Light: routes read them. */
export const VIEW_IDS = ["kirchhoff", "sun", "stars", "mystery"] as const;
export type ViewId = (typeof VIEW_IDS)[number];
/** The Sun, where Fraunhofer started, opens the lab. */
export const DEFAULT_VIEW: ViewId = "sun";
