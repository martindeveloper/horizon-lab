import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DebugCrash } from "@/components/debug/debug-crash";
import { SpectroscopyApp } from "@/features/spectroscopy";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";

import "@/features/spectroscopy/styles.css";
import { routing } from "@/i18n/routing";

export default async function SpectroscopyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [shared, spectroscopy] = await Promise.all([
    getMessages({ locale }),
    getSpectroscopyMessages(locale),
  ]);
  return (
    <NextIntlClientProvider locale={locale} messages={{ ...shared, spectroscopy }}>
      <div className="simulation-stage" data-simulation="spectroscopy">
        <Suspense>
          <SpectroscopyApp />
        </Suspense>
        {children}
        <DebugCrash scope="route" />
      </div>
    </NextIntlClientProvider>
  );
}
