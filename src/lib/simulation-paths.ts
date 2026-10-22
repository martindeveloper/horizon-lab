import { recordFrom } from "@horizon/toolkit/records";

import { LOCALES } from "../i18n/locales";
import type { BodyRef } from "../space/body-reference";
import { EXPERIENCE_PREFIX, PAGE_URLS, SIMULATION_PREFIX } from "./urls";

export { EXPERIENCE_PREFIX, SIMULATION_PREFIX } from "./urls";

export type SimulationPath = `${typeof SIMULATION_PREFIX | typeof EXPERIENCE_PREFIX}/${string}`;

/** Serializable entries shared by navigation and the feature's model. */
export type RouteEntry<Id extends string = string> = {
  id: Id;
  aliases?: readonly string[];
  body?: BodyRef;
  /** This route offers a detailed view of its body in another lab. */
  closeUp?: boolean;
};

export type RouteDefinition<Id extends string = string, Param extends string = string> = {
  base: SimulationPath;
  param: Param;
  defaultId: Id;
  entries: readonly RouteEntry<Id>[];
  aliases?: Readonly<Record<string, Id>>;
  /** Only historical addresses belong here; canonical routes are always derived. */
  legacy?: { bases: readonly string[]; rootAliases?: boolean };
};

/** Validate at definition time, before a bad address can reach a picker or a static build. */
export function defineRoutes<
  const Entries extends readonly RouteEntry[],
  const Param extends string,
>(
  definition: Omit<RouteDefinition<Entries[number]["id"], Param>, "entries" | "defaultId"> & {
    entries: Entries;
    defaultId: NoInfer<Entries[number]["id"]>;
  },
) {
  const ids = new Set<string>();
  const targets = new Map<string, string>();
  const add = (slug: string, id: string) => {
    if (
      slug !== slug.normalize("NFC").toLowerCase() ||
      !/^[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]*$/u.test(slug)
    )
      throw new Error(`Invalid route slug "${slug}" in ${definition.base}`);
    const previous = targets.get(slug);
    if (previous !== undefined && previous !== id)
      throw new Error(`Conflicting route alias "${slug}" in ${definition.base}`);
    targets.set(slug, id);
  };
  for (const { id } of definition.entries) {
    if (ids.has(id)) throw new Error(`Duplicate route id "${id}" in ${definition.base}`);
    ids.add(id);
    add(id, id);
  }
  if (!ids.has(definition.defaultId))
    throw new Error(`Unknown default route "${definition.defaultId}" in ${definition.base}`);
  for (const entry of definition.entries) {
    if (entry.closeUp && !entry.body) throw new Error(`Close-up route ${entry.id} needs a body`);
    for (const alias of entry.aliases ?? []) add(alias, entry.id);
  }
  for (const [alias, id] of Object.entries(definition.aliases ?? {})) {
    if (!ids.has(id)) throw new Error(`Unknown alias target "${id}" in ${definition.base}`);
    add(alias, id);
  }
  return definition;
}

export function simulationPath<const Slug extends string>(slug: Slug) {
  return `${SIMULATION_PREFIX}/${slug}` as const;
}

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
export const slugPath = <const Base extends string>(base: Base, defaultId: string, id: string) =>
  id === defaultId ? base : (`${base}/${encodeURIComponent(id)}` as const);

/**
 * URL slugs for a simulation's presets or views: the default lives at `base`,
 * the rest at `base/<id>`. Aliases (lower-case) map old or friendly names to
 * an id and become native redirects. Definitions are validated by defineRoutes.
 */
export function slugRoutes<Id extends string, Param extends string = "view">(
  definition: RouteDefinition<Id, Param>,
) {
  const { base, defaultId } = definition;
  const ids = definition.entries.map(({ id }) => id);
  const aliases: Readonly<Record<string, string>> = {
    ...Object.fromEntries(
      definition.entries.flatMap((entry) =>
        (entry.aliases ?? []).map((alias) => [alias, entry.id]),
      ),
    ),
    ...definition.aliases,
  };
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
      try {
        return resolve(decodeURIComponent(segmentsAfter(base, path)[0] ?? "")) ?? defaultId;
      } catch {
        return defaultId;
      }
    },
    /** Ids that need their own prerendered route. */
    slugs: () => ids.filter((id) => id !== defaultId),
    /** The App Router parameter name is part of the same definition as its addresses. */
    params: () =>
      ids.filter((id) => id !== defaultId).map((id) => recordFrom([definition.param], () => id)),
    paths: () => [base, ...ids.filter((id) => id !== defaultId).map((id) => pathFor(id))],
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
