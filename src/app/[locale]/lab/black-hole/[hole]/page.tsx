import type { Metadata } from "next";
import { hasLocale, createTranslator } from "next-intl";
import { notFound } from "next/navigation";

import { BLACK_HOLE_PATH } from "@/features/black-hole/manifest";
import { pathForHole, resolveHole, presetRouteParams } from "@/features/black-hole/routing";
import { getBlackHoleMessages } from "@/features/black-hole/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; hole: string }> };
export const generateStaticParams = presetRouteParams;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, hole } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = createTranslator({
    locale: "en",
    messages: await getBlackHoleMessages("en"),
  });
  const id = resolveHole(hole);
  const path = id ? pathForHole(id) : BLACK_HOLE_PATH;
  return pageMetadata({
    path,
    title: `${id ? `${t(`presets.${id}`)} · ` : ""}${t("app")} · Horizon`,
    description: t("metadataDescription"),
    image: "/simulations/black-hole/og.png",
    imageAlt: `Horizon · ${t("holes")}`,
  });
}
export default async function HolePage({ params }: Props) {
  const { locale, hole } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const id = resolveHole(hole);
  if (!id) redirect({ href: BLACK_HOLE_PATH, locale });
  const path = pathForHole(id!);
  if (`${BLACK_HOLE_PATH}/${hole}` !== path) redirect({ href: path, locale });
  return null;
}
