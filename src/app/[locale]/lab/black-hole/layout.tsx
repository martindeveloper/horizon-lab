import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DebugCrash } from "@/components/debug/debug-crash";
import { BlackHoleApp } from "@/features/black-hole";
import { getBlackHoleMessages } from "@/features/black-hole/server";

import "@/features/black-hole/styles.css";
import { routing } from "@/i18n/routing";

export default async function BlackHoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [shared, blackHole] = await Promise.all([
    getMessages({ locale }),
    getBlackHoleMessages(locale),
  ]);
  return (
    <NextIntlClientProvider locale={locale} messages={{ ...shared, blackHole }}>
      <div className="simulation-stage" data-simulation="black-hole">
        <Suspense>
          <BlackHoleApp />
        </Suspense>
        {children}
        <DebugCrash scope="route" />
      </div>
    </NextIntlClientProvider>
  );
}
