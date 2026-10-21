import type { Metadata } from "next";
import { createTranslator, hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { FEATURES, type FeatureId } from "@/config";
import { routing, type Locale } from "@/i18n/routing";

/** Supply complete social objects: Next replaces nested metadata rather than merging it. */
export function pageMetadata({
  path,
  title,
  description,
  image,
  imageAlt,
}: {
  path: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}): Metadata {
  // Every language shares one URL; the locale cookie picks the copy.
  const alternates = { canonical: path };
  const images = [{ url: image, width: 1200, height: 630, type: "image/png", alt: imageAlt }];
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      images,
      type: "website",
      siteName: "Horizon",
      url: alternates.canonical,
      // Share copy is English for every route.
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/** A route's params with the locale narrowed to a known one; any other value is a 404. */
export async function localeParam<Params extends { locale: string }>(params: Promise<Params>) {
  const resolved = await params;
  const { locale } = resolved;
  if (!hasLocale(routing.locales, locale)) notFound();
  return { ...resolved, locale };
}

/** A feature catalog: `app` names the simulation and `metadataDescription` describes it. */
type SimulationMessages = Record<string, unknown> & { app: string; metadataDescription: string };

type SimulationMetadataSpec<Messages extends SimulationMessages, Id extends string> = {
  /** The feature switch the simulation is behind: off, the route's metadata is not found too. */
  feature?: FeatureId;
  /** Server-only loader of the feature's copy. */
  messages: (locale: Locale) => Promise<Messages>;
  /** The simulation's social card under `public/`. */
  image: string;
} & (
  | {
      /** Canonical path of the default view. */
      path: string;
      view?: undefined;
    }
  | {
      path?: undefined;
      /** A `[slug]` route: its param, how the slug resolves, and the view's title. */
      view: {
        param: string;
        resolve: (slug: string | undefined) => Id | null;
        pathFor: (id: Id) => string;
        title: (t: ReturnType<typeof createTranslator<Messages>>, id: Id) => string;
      };
    }
);

/**
 * `generateMetadata` for a simulation's default view or one of its `[slug]` views:
 * `View · App · Horizon` with the feature's description and card. Share copy is
 * English for every route.
 */
export function simulationMetadata<Messages extends SimulationMessages, Id extends string>(
  spec: SimulationMetadataSpec<Messages, Id>,
) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string } & Record<string, string>>;
  }): Promise<Metadata> {
    if (spec.feature && !FEATURES[spec.feature]) notFound();
    const resolved = await localeParam(params);
    const messages = await spec.messages("en");
    const card = {
      description: messages.metadataDescription,
      image: spec.image,
      imageAlt: `Horizon · ${messages.app}`,
    };
    if (!spec.view) {
      return pageMetadata({ ...card, path: spec.path, title: `${messages.app} · Horizon` });
    }
    // Only canonical ids are prerendered (dynamicParams is false), so the slug always resolves.
    const id = spec.view.resolve(resolved[spec.view.param])!;
    const t = createTranslator({ locale: "en", messages });
    return pageMetadata({
      ...card,
      path: spec.view.pathFor(id),
      title: `${spec.view.title(t, id)} · ${messages.app} · Horizon`,
    });
  };
}
