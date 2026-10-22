"use client";

import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";

import { AppThemeProvider } from "@/components/providers";
import { cookieLocale } from "@/components/status/status-locale";
import {
  StatusPage,
  statusActionClass,
  statusPrimaryActionClass,
} from "@/components/status/status-page";
import { routing } from "@/i18n/routing";
import { PAGE_URLS } from "@/lib/urls";

import cs from "../messages/status/cs.json";
import en from "../messages/status/en.json";

import "../styles.css";

const subscribe = () => () => {};

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  // Clean URLs carry no language: without a route param, the cookie decides.
  const saved = useSyncExternalStore(
    subscribe,
    () => cookieLocale(document.cookie),
    () => routing.defaultLocale,
  );
  const locale = routing.locales.find((value) => value === params?.locale) ?? saved;
  const copy = locale === "cs" ? cs : en;
  return (
    <html lang={locale} className="antialiased" suppressHydrationWarning>
      <head>
        <title>500 · Horizon</title>
        <meta name="robots" content="noindex" />
      </head>
      <body className="bg-surface-primary text-fg-primary">
        <AppThemeProvider>
          <StatusPage fullPage code="500" title={copy.errorTitle} description={copy.errorBody}>
            <button type="button" onClick={reset} className={statusPrimaryActionClass}>
              {copy.tryAgain}
            </button>
            {/* A full load recovers from a crashed root layout; client navigation cannot. */}
            <a href={PAGE_URLS.home} className={statusActionClass}>
              {copy.returnHome}
            </a>
          </StatusPage>
        </AppThemeProvider>
      </body>
    </html>
  );
}
