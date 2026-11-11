import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ChangelogPage } from "@/components/pages/changelog-page";
import { localeParam, pageMetadata } from "@/lib/metadata";
import { PAGE_URLS, PUBLIC_ASSETS } from "@/lib/urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await localeParam(params);
  const t = await getTranslations({ locale: "en", namespace: "changelog" });
  return pageMetadata({
    path: PAGE_URLS.changelog,
    description: t("metadataDescription"),
    image: PUBLIC_ASSETS.social,
    imageAlt: "Horizon",
    title: `${t("kicker")} · Horizon`,
  });
}

export default async function Changelog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await localeParam(params);
  return <ChangelogPage locale={locale} />;
}
