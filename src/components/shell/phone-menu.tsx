"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { simulationForPath, simulations } from "@/lib/simulations";
import { SegmentedControl, cn } from "@horizon/toolkit/ui";

import { FooterLinks } from "./footer-links";
import { ThemeSwitch, useThemeLabels } from "./theme-switch";
import { useDismissOnEscape } from "./use-dismiss-on-escape";

const kicker = "font-mono text-[10px] tracking-[0.22em] text-subtle uppercase";

/**
 * Phones fold the header's way back, its preferences and the footer's links into one menu
 * that drops from the bar: the simulations, language and appearance, then About, Credits,
 * GitHub and the sidereal clock. Over a simulation the footer gives its line to the scene.
 */
export function PhoneMenu({
  className,
  locale,
  languageLabels,
  onLocale,
}: {
  className?: string;
  locale: Locale;
  languageLabels: Record<Locale, string>;
  onLocale: (locale: Locale) => void;
}) {
  const t = useTranslations();
  const shell = useTranslations("shell");
  const themeLabels = useThemeLabels();
  const pathname = usePathname();
  const current = simulationForPath(pathname);
  /* Open on the page it was opened on, so any navigation closes it. */
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => setOpenOn(null);
  useDismissOnEscape(open, button, close);

  useEffect(() => {
    if (!open) return;
    /* The page under the dimmed scrim holds still. */
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
    };
  }, [open]);

  return (
    <div className={cn("shrink-0", className)}>
      <button
        ref={button}
        type="button"
        aria-label={open ? t("shell.closeMenu") : t("shell.menu")}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpenOn(open ? null : pathname)}
        className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden aria-expanded:text-fg"
      >
        {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
      </button>

      {open ? (
        <>
          {/* The scene stays in view, dimmed; a tap on it closes the menu. */}
          <div
            aria-hidden
            className="phone-menu-scrim anim-fade absolute inset-x-0 top-full h-dvh"
            onClick={close}
          />
          <nav
            id={id}
            aria-label={t("shell.menu")}
            className="phone-menu hairline-solar absolute inset-x-0 top-full max-h-[calc(100dvh-var(--app-header-height))] overflow-y-auto overscroll-contain rounded-b-2xl px-(--app-gutter) pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            {/* Held sideways, the simulations and the preferences sit side by side. */}
            <div className="grid sm:grid-cols-2 sm:gap-x-10">
              <div>
                <p aria-hidden className={kicker}>
                  {t("catalogue.collection")}
                </p>
                <ul className="-mx-3 mt-1.5">
                  {simulations.map((simulation) => {
                    const here = simulation.id === current?.id;
                    return (
                      <li key={simulation.id}>
                        <Link
                          href={simulation.href}
                          prefetch={false}
                          aria-current={here ? "page" : undefined}
                          onClick={close}
                          className="flex min-h-12 items-center justify-between gap-4 rounded-xl px-3 py-2 transition-colors hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                        >
                          <span className="min-w-0">
                            <span className="block text-[15px] font-medium tracking-tight text-fg">
                              {t(`catalogue.${simulation.messageKey}.title`)}
                            </span>
                            <span className="block text-xs text-muted">
                              {t(`catalogue.${simulation.messageKey}.category`)}
                            </span>
                          </span>
                          {here ? (
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--solar)/0.7)]"
                            />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-3 grid content-start gap-4 border-t border-border pt-4 sm:mt-0 sm:border-t-0 sm:pt-0">
                <div>
                  <p aria-hidden className={cn(kicker, "mb-2")}>
                    {t("shell.language")}
                  </p>
                  <SegmentedControl
                    aria-label={t("shell.language")}
                    value={locale}
                    onValueChange={onLocale}
                    options={routing.locales.map((value) => ({
                      value,
                      label: <span lang={value}>{languageLabels[value]}</span>,
                    }))}
                  />
                </div>
                <div>
                  <p aria-hidden className={cn(kicker, "mb-2")}>
                    {t("theme")}
                  </p>
                  <ThemeSwitch label={t("theme")} labels={themeLabels} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex h-10 items-center justify-between gap-4 border-t border-border pt-1 font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
              <FooterLinks t={shell} menu onNavigate={close} />
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
