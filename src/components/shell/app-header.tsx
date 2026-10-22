"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { localeCookie, type Locale } from "@/i18n/routing";
import { simulationForPath } from "@/lib/simulations";
import { FRAGMENT_URLS, PAGE_URLS } from "@/lib/urls";

import { Wordmark } from "./brand";
import { HeaderPreferences } from "./header-preferences";
import { MusicToggle } from "./music-toggle";
import { PhoneMenu } from "./phone-menu";

const languageLabels: Record<Locale, string> = { en: "English", cs: "Čeština" };

export function AppHeader() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const simulation = simulationForPath(pathname);

  // The URL has no language: the cookie picks it and a reload serves that
  // locale's prerendered page. The locale layout owns <html>, so a full load
  // also matches how Next.js moves between root layouts.
  function changeLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = localeCookie(next);
    // Let the header lens finish its slide before the page reloads.
    window.setTimeout(() => window.location.reload(), 220);
  }

  return (
    <div className="app-bar flex h-full items-center gap-2.5 md:gap-3">
      <a
        href={FRAGMENT_URLS.mainContent}
        className="action-fill sr-only rounded-full px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:z-[120]"
      >
        {t("shell.skip")}
      </a>

      <Link
        href={PAGE_URLS.home}
        className="inline-flex h-11 shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        aria-label={t("shell.home")}
      >
        <Wordmark />
      </Link>

      <div className="flex min-w-0 flex-1 items-center">
        {simulation ? (
          <nav
            aria-label={t("shell.breadcrumb")}
            className="flex min-w-0 items-center gap-2.5 text-[13px] text-muted"
          >
            <span className="h-3.5 w-px shrink-0 bg-border-strong" aria-hidden />
            <span className="truncate" aria-current="page">
              {t(`catalogue.${simulation.messageKey}.title`)}
            </span>
          </nav>
        ) : null}
      </div>

      {/* Phones find the way back in their menu. */}
      {simulation ? (
        <Link
          href={PAGE_URLS.home}
          prefetch={false}
          className="glass-pill relative hidden h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-fg/90 transition-colors after:absolute after:-inset-1.5 hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:inline-flex"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t("shell.catalogue")}
        </Link>
      ) : null}

      <MusicToggle />

      <HeaderPreferences
        className="hidden md:flex"
        locale={locale}
        languageLabels={languageLabels}
        onLocale={changeLocale}
      />

      <PhoneMenu
        className="md:hidden"
        locale={locale}
        languageLabels={languageLabels}
        onLocale={changeLocale}
      />
    </div>
  );
}
