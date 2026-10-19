import type { Metadata } from "next";
import { createTranslator, hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { SPECTROSCOPY_PATH } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = createTranslator({ locale: "en", messages: await getSpectroscopyMessages("en") });
  return pageMetadata({
    path: SPECTROSCOPY_PATH,
    title: `${t("app")} · Horizon`,
    description: t("metadataDescription"),
    image: "/simulations/spectroscopy/og.png",
    imageAlt: `Horizon · ${t("app")}`,
  });
}

export default function SpectroscopyPage() {
  return null;
}
