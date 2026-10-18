import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DebugCrash } from "@/components/debug/debug-crash";
import { OrreryApp } from "@/features/orrery";
import { getOrreryMessages } from "@/features/orrery/server";

import "@horizon/toolkit/scene.css";
import "@/features/orrery/styles.css";
import { routing } from "@/i18n/routing";

export default async function OrreryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [shared, orrery] = await Promise.all([getMessages({ locale }), getOrreryMessages(locale)]);
  return (
    <NextIntlClientProvider locale={locale} messages={{ ...shared, orrery }}>
      <div className="simulation-stage" data-simulation="orrery">
        <Suspense>
          <OrreryApp />
        </Suspense>
        {children}
        <DebugCrash scope="route" />
      </div>
    </NextIntlClientProvider>
  );
}
