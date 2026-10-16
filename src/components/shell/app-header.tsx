"use client";

import { ArrowLeft, Settings2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { localeCookie, routing, type Locale } from "@/i18n/routing";
import { simulationForPath } from "@/lib/simulations";
import { IconButton, SegmentedControl, Surface } from "@horizon/toolkit/ui";

import { Wordmark } from "./brand";
import { HeaderPreferences } from "./header-preferences";
import { MusicToggle } from "./music-toggle";
import { ThemeSwitch } from "./theme-switch";

const languageLabels: Record<Locale, string> = { en: "English", cs: "Čeština" };

export function AppHeader() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const simulation = simulationForPath(pathname);
  const preferences = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (preferences.current) preferences.current.open = false;
  }, [pathname, locale]);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const target = event.target;
      if (preferences.current && !(target instanceof Node && preferences.current.contains(target)))
        preferences.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && preferences.current?.open) {
        preferences.current.open = false;
        preferences.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  // The URL has no language: the cookie picks it and a reload serves that
  // locale's prerendered page. The locale layout owns <html>, so a full load
  // also matches how Next.js moves between root layouts.
  function changeLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = localeCookie(next);
    // Let the header lens finish its slide before the page reloads.
    window.setTimeout(() => window.location.reload(), 220);
  }

  function closePreferences() {
    if (!preferences.current) return;
    preferences.current.open = false;
    preferences.current.querySelector("summary")?.focus();
  }

  return (
    <div className="app-bar flex h-full items-center gap-2.5 md:gap-3">
      <a
        href="#main-content"
        className="sr-only rounded-full bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:absolute focus:left-4 focus:z-[120]"
      >
        {t("shell.skip")}
      </a>

      <Link
        href="/"
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

      {simulation ? (
        <Link
          href="/"
          prefetch={false}
          className="glass-pill relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-fg/90 transition-colors after:absolute after:-inset-1.5 hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{t("shell.catalogue")}</span>
          <span className="sr-only sm:hidden">{t("shell.catalogue")}</span>
        </Link>
      ) : null}

      <MusicToggle />

      <HeaderPreferences
        className="hidden md:flex"
        locale={locale}
        languageLabels={languageLabels}
        onLocale={changeLocale}
      />

      <details ref={preferences} className="relative shrink-0 md:hidden">
        <summary
          className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden [&::-webkit-details-marker]:hidden"
          aria-label={t("shell.preferences")}
        >
          <Settings2 className="size-4" aria-hidden />
        </summary>
        <Surface
          variant="popover"
          className="hairline-solar anim-rise absolute top-[calc(100%+0.5rem)] right-0 w-72 max-w-[calc(100vw-2rem)] space-y-5 overflow-hidden rounded-2xl p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-[15px] font-semibold tracking-tight">{t("shell.preferences")}</p>
            <IconButton aria-label={t("shell.closePreferences")} onClick={closePreferences}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div>
            <p
              aria-hidden
              className="mb-2 font-mono text-[10px] tracking-[0.22em] text-subtle uppercase"
            >
              {t("shell.language")}
            </p>
            <SegmentedControl
              aria-label={t("shell.language")}
              value={locale}
              onValueChange={changeLocale}
              options={routing.locales.map((value) => ({
                value,
                label: <span lang={value}>{languageLabels[value]}</span>,
              }))}
            />
          </div>
          <div className="border-t border-border pt-4">
            <p
              aria-hidden
              className="mb-2 font-mono text-[10px] tracking-[0.22em] text-subtle uppercase"
            >
              {t("theme")}
            </p>
            <ThemeSwitch
              label={t("theme")}
              labels={{
                dark: t("themeDark"),
                light: t("themeLight"),
                system: t("themeSystem"),
              }}
            />
          </div>
        </Surface>
      </details>
    </div>
  );
}
