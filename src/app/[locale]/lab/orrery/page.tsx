import type { Metadata } from "next";
import { createTranslator, hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ORRERY_PATH } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = createTranslator({ locale: "en", messages: await getOrreryMessages("en") });
  return pageMetadata({
    path: ORRERY_PATH,
    title: `${t("app")} · Horizon`,
    description: t("metadataDescription"),
    image: "/simulations/orrery/og.png",
    imageAlt: `Horizon · ${t("app")}`,
  });
}

export default function OrreryPage() {
  return null;
}
