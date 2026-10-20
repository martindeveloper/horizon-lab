"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { SegmentedControl } from "@horizon/toolkit/ui";

export type ThemeMode = "light" | "dark" | "system";
export const themeModes = ["dark", "light", "system"] as const;
const subscribe = () => () => {};

/** The stored theme is unknown on the server: report dark until hydrated. */
export function useThemeMode() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();
  const value: ThemeMode = mounted && (theme === "light" || theme === "system") ? theme : "dark";
  return { mounted, value, setTheme: (mode: ThemeMode) => setTheme(mode) };
}

/** The three modes as the visitor reads them, from the root message namespace. */
export function useThemeLabels(): Record<ThemeMode, string> {
  const t = useTranslations();
  return { dark: t("themeDark"), light: t("themeLight"), system: t("themeSystem") };
}

export function ThemeSwitch({
  label,
  labels,
}: {
  label: string;
  labels: Record<ThemeMode, string>;
}) {
  const { mounted, value, setTheme } = useThemeMode();
  return (
    <SegmentedControl
      aria-label={label}
      className="[&>button]:min-w-11"
      value={value}
      onValueChange={setTheme}
      disabled={!mounted}
      options={themeModes.map((value) => ({
        value,
        label: labels[value],
      }))}
    />
  );
}
