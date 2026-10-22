"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { routing, type Locale } from "@/i18n/routing";
import { Tooltip, cn, controlSpring } from "@horizon/toolkit/ui";

import { themeModes, useThemeLabels, useThemeMode, type ThemeMode } from "./theme-switch";

const loadFeatures = () => import("./motion-features").then((module) => module.default);

const themeIcons: Record<ThemeMode, { icon: typeof Sun; turn: number }> = {
  dark: { icon: Moon, turn: -24 },
  light: { icon: Sun, turn: 90 },
  system: { icon: Monitor, turn: 0 },
};

function Rail<T extends string>({
  label,
  value,
  options,
  width,
  ready = true,
  edge = false,
  onChange,
  render,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; lang?: string; short?: string }[];
  width: number;
  ready?: boolean;
  /** The rail ends at the window's right gutter: its last tip aligns to the edge. */
  edge?: boolean;
  onChange: (value: T) => void;
  render: (value: T, active: boolean) => ReactNode;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div role="group" aria-label={label} className="glass-pill relative flex rounded-full p-0.5">
      {ready ? (
        <m.span
          aria-hidden
          className="header-lens absolute top-0.5 left-0.5 h-7 rounded-full"
          style={{ width }}
          initial={false}
          animate={{ x: index * width }}
          transition={controlSpring}
        />
      ) : null}
      {options.map((option, i) => {
        const active = ready && option.value === value;
        return (
          <Tooltip
            key={option.value}
            label={option.label}
            align={edge && i === options.length - 1 ? "end" : "center"}
          >
            <button
              type="button"
              aria-label={option.short ? `${option.short}, ${option.label}` : option.label}
              aria-pressed={active}
              lang={option.lang}
              disabled={!ready}
              onClick={() => onChange(option.value)}
              style={{ width }}
              className={cn(
                "relative flex h-7 items-center justify-center rounded-full transition-colors duration-feedback ease-standard focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden disabled:opacity-40",
                active ? "text-accent" : "text-fg-tertiary hover:text-fg-primary",
              )}
            >
              {render(option.value, active)}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function HeaderPreferences({
  locale,
  languageLabels,
  onLocale,
  className,
}: {
  locale: Locale;
  languageLabels: Record<Locale, string>;
  onLocale: (locale: Locale) => void;
  className?: string;
}) {
  const t = useTranslations();
  const theme = useThemeMode();
  const themeLabels = useThemeLabels();
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div className={cn("items-center gap-2", className)}>
          <Rail
            label={t("shell.language")}
            value={locale}
            width={34}
            options={routing.locales.map((value) => ({
              value,
              label: languageLabels[value],
              lang: value,
              short: value.toUpperCase(),
            }))}
            onChange={onLocale}
            render={(value) => (
              <span className="font-mono text-micro font-medium tracking-instrument uppercase">
                {value}
              </span>
            )}
          />
          <Rail
            label={t("theme")}
            value={theme.value}
            width={30}
            ready={theme.mounted}
            edge
            options={themeModes.map((value) => ({ value, label: themeLabels[value] }))}
            onChange={theme.setTheme}
            render={(value, active) => {
              const { icon: Icon, turn } = themeIcons[value];
              return (
                <m.span
                  className="flex"
                  initial={false}
                  animate={{ rotate: active ? turn : 0, scale: active ? 1 : 0.86 }}
                  transition={controlSpring}
                >
                  <Icon className="size-3.5" aria-hidden />
                </m.span>
              );
            }}
          />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
