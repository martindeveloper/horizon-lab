import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BLACK_HOLE_PATH } from "@/features/black-hole/manifest";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale: "en" });
  return pageMetadata({
    path: BLACK_HOLE_PATH,
    image: "/simulations/black-hole/og.png",
    imageAlt: `Horizon · ${t("catalogue.blackHole.title")}`,
    title: `${t("catalogue.blackHole.title")} · Horizon`,
    description: t("catalogue.blackHole.description"),
  });
}
export default function BlackHolePage() {
  return null;
}
