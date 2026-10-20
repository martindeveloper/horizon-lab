import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CreditsPage } from "@/components/pages/credits-page";

import "@/components/pages/credits.css";
import { localeParam, pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await localeParam(params);
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
  const { locale } = await localeParam(params);
  return <CreditsPage locale={locale} />;
}
