import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { preconnect } from "react-dom";

import { AppThemeProvider } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { LocaleUrl } from "@/components/shell/locale-url";
import { ANALYTICS, siteUrl } from "@/config";
import { routing } from "@/i18n/routing";
import { assetOrigin } from "@/lib/assets";
import { localeParam } from "@/lib/metadata";
import { PUBLIC_ASSETS } from "@/lib/urls";

/* Fonts ship with the site (Fontsource, from npm): no request to a font CDN, and
   each subset file loads only when a page uses its characters. */
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource-variable/ibm-plex-sans/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import "../../styles.css";

export const dynamicParams = false;

type Props = { children: ReactNode; params: Promise<{ locale: string }> };
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeParam(params);
  const t = await getTranslations({ locale: "en" });
  return {
    metadataBase: siteUrl(),
    title: t("app"),
    description: t("metadataDescription"),
    icons: { icon: PUBLIC_ASSETS.favicon, apple: PUBLIC_ASSETS.appleIcon },
  };
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080b",
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await localeParam(params);
  const messages = await getMessages({ locale });
  // Music and the orrery's maps come from the CDN, both fetched with CORS.
  preconnect(assetOrigin, { crossOrigin: "anonymous" });
  return (
    <html lang={locale} className="antialiased" suppressHydrationWarning>
      <body className="bg-bg text-fg">
        <AppThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <LocaleUrl />
            <AppShell locale={locale}>{children}</AppShell>
          </NextIntlClientProvider>
        </AppThemeProvider>
        {ANALYTICS ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
