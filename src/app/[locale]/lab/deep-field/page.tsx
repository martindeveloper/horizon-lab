import type { Metadata } from "next";
import { createTranslator, hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { DEEP_FIELD_PATH } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = createTranslator({ locale: "en", messages: await getDeepFieldMessages("en") });
  return pageMetadata({
    path: DEEP_FIELD_PATH,
    title: `${t("app")} · Horizon`,
    description: t("metadataDescription"),
    image: "/simulations/deep-field/og.png",
    imageAlt: `Horizon · ${t("app")}`,
  });
}

export default function DeepFieldPage() {
  return null;
}
