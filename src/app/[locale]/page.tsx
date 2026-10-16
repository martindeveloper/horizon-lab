import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DebugCrash } from "@/components/debug/debug-crash";
import { Catalogue } from "@/features/catalogue";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
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
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <>
      <Catalogue locale={locale} />
      <DebugCrash scope="route" />
    </>
  );
}
