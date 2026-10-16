import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CreditsPage } from "@/components/pages/credits-page";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale: "en", namespace: "credits" });
  return pageMetadata({
    path: "/credits",
    description: t("metadataDescription"),
    image: "/social/horizon.png",
    imageAlt: "Horizon",
    title: `${t("kicker")} · Horizon`,
  });
}

export default async function Credits({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <CreditsPage locale={locale} />;
}
