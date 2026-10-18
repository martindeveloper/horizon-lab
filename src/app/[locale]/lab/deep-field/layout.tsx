import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DebugCrash } from "@/components/debug/debug-crash";
import { DeepFieldApp } from "@/features/deep-field";
import { getDeepFieldMessages } from "@/features/deep-field/server";

import "@horizon/toolkit/scene.css";
import "@/features/deep-field/styles.css";
import { routing } from "@/i18n/routing";

export default async function DeepFieldLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [shared, deepField] = await Promise.all([
    getMessages({ locale }),
    getDeepFieldMessages(locale),
  ]);
  return (
    <NextIntlClientProvider locale={locale} messages={{ ...shared, deepField }}>
      <div className="simulation-stage" data-simulation="deep-field">
        <Suspense>
          <DeepFieldApp />
        </Suspense>
        {children}
        <DebugCrash scope="route" />
      </div>
    </NextIntlClientProvider>
  );
}
