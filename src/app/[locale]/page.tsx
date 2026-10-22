import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DebugCrash } from "@/components/debug/debug-crash";
import { Catalogue } from "@/features/catalogue";
import { localeParam, pageMetadata } from "@/lib/metadata";
import { PAGE_URLS, PUBLIC_ASSETS } from "@/lib/urls";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await localeParam(params);
  const t = await getTranslations({ locale: "en" });
  return pageMetadata({
    path: PAGE_URLS.home,
    description: t("metadataDescription"),
    image: PUBLIC_ASSETS.social,
    imageAlt: "Horizon",
    title: t("shell.homeTitle"),
  });
}
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await localeParam(params);
  return (
    <>
      <Catalogue locale={locale} />
      <DebugCrash scope="route" />
    </>
  );
}
