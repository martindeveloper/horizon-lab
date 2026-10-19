import type { Metadata } from "next";
import { createTranslator, hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { SPECTROSCOPY_PATH } from "@/features/spectroscopy/manifest";
import { pathForView, resolveView, viewRouteParams } from "@/features/spectroscopy/routing";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";

export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; view: string }> };
export const generateStaticParams = viewRouteParams;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, view } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = createTranslator({ locale: "en", messages: await getSpectroscopyMessages("en") });
  const id = resolveView(view);
  return pageMetadata({
    path: id ? pathForView(id) : SPECTROSCOPY_PATH,
    title: `${id ? `${t(`views.${id}.title`)} · ` : ""}${t("app")} · Horizon`,
    description: t("metadataDescription"),
    image: "/simulations/spectroscopy/og.png",
    imageAlt: `Horizon · ${t("app")}`,
  });
}

export default async function ViewPage({ params }: Props) {
  const { locale, view } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const id = resolveView(view);
  if (!id) redirect({ href: SPECTROSCOPY_PATH, locale });
  const path = pathForView(id!);
  if (`${SPECTROSCOPY_PATH}/${view}` !== path) redirect({ href: path, locale });
  return null;
}
