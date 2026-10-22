import "server-only";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ComponentType, type ReactNode } from "react";

import { DebugCrash } from "@/components/debug/debug-crash";
import type { Locale } from "@/i18n/routing";
import { localeParam } from "@/lib/metadata";
import { simulationOn } from "@/lib/simulation-access";
import type { SimulationManifest } from "@/lib/simulation-types";

type SimulationLayoutSpec = {
  /** Supplies the feature switch, stylesheet scope and translation namespace. */
  manifest: SimulationManifest;
  /** The client entry, kept mounted across the simulation's routes so the canvas survives view navigation. */
  App: ComponentType;
  /** Server-only loader of the feature's copy. */
  messages: (locale: Locale) => Promise<AbstractIntlMessages>;
};

/**
 * The layout every simulation route shares: shared and feature copy for the client,
 * the stage and the persistent scene. The route file imports the feature's stylesheet.
 */
export function simulationLayout({ manifest, App, messages }: SimulationLayoutSpec) {
  return async function SimulationLayout({
    children,
    params,
  }: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
  }) {
    if (!simulationOn(manifest)) notFound();
    const { locale } = await localeParam(params);
    const [shared, own] = await Promise.all([getMessages({ locale }), messages(locale)]);
    return (
      <NextIntlClientProvider locale={locale} messages={{ ...shared, [manifest.messageKey]: own }}>
        <div className="simulation-stage" data-simulation={manifest.id}>
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
