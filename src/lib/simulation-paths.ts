import { LOCALES } from "../i18n/locales";
import { PAGE_URLS } from "./urls";

/** Shared URL prefixes: the labs live under one, the experiences under the other. */
export const SIMULATION_PREFIX = "/lab";
export const EXPERIENCE_PREFIX = "/experience";

export type SimulationPath = `${typeof SIMULATION_PREFIX | typeof EXPERIENCE_PREFIX}/${string}`;

/** A lab's path: a simulation to learn from. */
export function simulationPath<const Slug extends string>(slug: Slug) {
  return `${SIMULATION_PREFIX}/${slug}` as const;
}

/** An experience's path: a simulation to sit back in. */
export function experiencePath<const Slug extends string>(slug: Slug) {
  return `${EXPERIENCE_PREFIX}/${slug}` as const;
}

/** Path segments after `base`, ignoring the internal locale segment. */
function segmentsAfter(base: string, pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (LOCALES.some((locale) => locale === segments[0])) segments.shift();
  const parts = base.split("/").filter(Boolean);
  return parts.every((part, i) => segments[i] === part) ? segments.slice(parts.length) : segments;
}

/** The path of a preset or view: the default at `base`, the rest at `base/<id>`. */
export const slugPath = <const Base extends string, const Id extends string>(
  base: Base,
  defaultId: string,
  id: Id,
) => (id === defaultId ? base : (`${base}/${id}` as const));

/**
 * URL slugs for a simulation's presets or views: the default lives at `base`,
 * the rest at `base/<id>`. Aliases (lower-case) map old or friendly names to
 * an id and become native redirects; an alias to an unknown id is ignored.
 */
export function slugRoutes<Id extends string>({
  base,
  ids,
  defaultId,
  aliases = {},
}: {
  base: string;
  ids: readonly Id[];
  defaultId: Id;
  aliases?: Readonly<Record<string, string>>;
}) {
  const known = (key: string): key is Id => ids.some((id) => id === key);
  /** The id a slug names; the default for an empty slug, null when unknown. */
  const resolve = (slug: string | undefined): Id | null => {
    if (!slug) return defaultId;
    const key = slug.trim().toLowerCase();
    const alias = Object.hasOwn(aliases, key) ? aliases[key] : undefined;
    if (alias !== undefined && known(alias)) return alias;
    return known(key) ? key : null;
  };
  /** Canonical path; unknown ids fall back to the default. */
  const pathFor = (id: string) => (known(id) ? slugPath(base, defaultId, id) : base);
  return {
    resolve,
    pathFor,
    /** The id for a pathname (the current one in the browser), else the default. */
    fromPath: (pathname?: string): Id => {
      const path =
        pathname ?? (typeof window === "undefined" ? PAGE_URLS.home : window.location.pathname);
      return resolve(segmentsAfter(base, path)[0] ?? "") ?? defaultId;
    },
    /** Ids that need their own prerendered route. */
    slugs: () => ids.filter((id) => id !== defaultId),
    /** Every id and alias with its canonical path, for native redirects. */
    redirects: () => {
      const map = new Map<string, string>();
      for (const slug of [...ids, ...Object.keys(aliases)]) {
        const id = resolve(slug);
        if (id) map.set(slug, pathFor(id));
      }
      return map;
    },
  };
}
