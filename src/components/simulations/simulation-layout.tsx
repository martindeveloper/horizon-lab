import "server-only";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ComponentType, type ReactNode } from "react";

import { DebugCrash } from "@/components/debug/debug-crash";
import { FEATURES, type FeatureId } from "@/config";
import type { Locale } from "@/i18n/routing";
import { localeParam } from "@/lib/metadata";

type SimulationLayoutSpec = {
  /** The `data-simulation` root the feature's stylesheet scopes to. */
  slug: string;
  /** The feature switch the simulation is behind: off, its routes are not found. */
  feature?: FeatureId;
  /** The namespace the feature's components translate from. */
  namespace: string;
  /** The client entry, kept mounted across the simulation's routes so the canvas survives view navigation. */
  App: ComponentType;
  /** Server-only loader of the feature's copy. */
  messages: (locale: Locale) => Promise<AbstractIntlMessages>;
};

/**
 * The layout every simulation route shares: shared and feature copy for the client,
 * the stage and the persistent scene. The route file imports the feature's stylesheet.
 */
export function simulationLayout({
  slug,
  feature,
  namespace,
  App,
  messages,
}: SimulationLayoutSpec) {
  return async function SimulationLayout({
    children,
    params,
  }: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
  }) {
    if (feature && !FEATURES[feature]) notFound();
    const { locale } = await localeParam(params);
    const [shared, own] = await Promise.all([getMessages({ locale }), messages(locale)]);
    return (
      <NextIntlClientProvider locale={locale} messages={{ ...shared, [namespace]: own }}>
        <div className="simulation-stage" data-simulation={slug}>
          <Suspense>
            <App />
          </Suspense>
          {children}
          <DebugCrash scope="route" />
        </div>
      </NextIntlClientProvider>
    );
  };
}
