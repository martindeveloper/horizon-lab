import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DebugCrash } from "@/components/debug/debug-crash";
import { Catalogue } from "@/features/catalogue";
import { localeParam, pageMetadata } from "@/lib/metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await localeParam(params);
  const t = await getTranslations({ locale: "en" });
  return pageMetadata({
    path: "/",
    description: t("metadataDescription"),
    image: "/social/horizon.png",
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
