import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DebugCrash } from "@/components/debug/debug-crash";
import { AboutPage } from "@/components/pages/about-page";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale: "en", namespace: "about" });
  return pageMetadata({
    path: "/about",
    description: t("metadataDescription"),
    image: "/social/horizon.png",
    imageAlt: "Horizon",
    title: `${t("kicker")} · Horizon`,
  });
}

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <>
      <AboutPage locale={locale} />
      <DebugCrash scope="route" />
    </>
  );
}
