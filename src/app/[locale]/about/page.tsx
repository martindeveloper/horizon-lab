import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DebugCrash } from "@/components/debug/debug-crash";
import { AboutPage } from "@/components/pages/about-page";
import { localeParam, pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await localeParam(params);
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
  const { locale } = await localeParam(params);
  return (
    <>
      <AboutPage locale={locale} />
      <DebugCrash scope="route" />
    </>
  );
}
