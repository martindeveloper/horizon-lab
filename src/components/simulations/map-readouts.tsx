"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  DISTANCE_UNITS,
  formatReadout,
  type DistanceChoice,
  type DistanceUnit,
} from "@horizon/toolkit/science";
import { ScaleBar, SegmentedControl, cn } from "@horizon/toolkit/ui";

/**
 * A cartographic scale: the round distance the bar spans at the centre of the view, worded
 * by the shared space copy in `namespace`. Millions read as words: "200 million ly".
 */
export function MapScale({
  namespace,
  value,
  unit,
  px,
  onScene = false,
  className,
}: {
  namespace: string;
  value: number;
  unit: DistanceUnit;
  px: number;
  /** Drawn on the scene itself, not on a panel. */
  onScene?: boolean;
  className?: string;
}) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const millions = value >= 1e6;
  const number = formatReadout(millions ? value / 1e6 : value, locale);
  const text = millions ? `${number} ${t("names.million")}` : number;
  const symbol = t(`units.${unit}`);
  return (
    <ScaleBar
      text={`${text} ${symbol}`}
      px={px}
      label={t("hud.scale", { value: text, unit: symbol })}
      onScene={onScene}
      {...(className ? { className } : {})}
    />
  );
}

const CHOICES: readonly DistanceChoice[] = ["auto", ...DISTANCE_UNITS];

/** The visitor's distance unit for every readout: automatic, au, ly or pc. */
export function DistanceUnitControl({
  namespace,
  value,
  onChange,
  className,
}: {
  namespace: string;
  value: DistanceChoice;
  onChange: (unit: DistanceChoice) => void;
  className?: string;
}) {
  const t = useTranslations(namespace);
  return (
    <SegmentedControl<DistanceChoice>
      aria-label={t("hud.distanceUnit")}
      className={cn("gap-2", className)}
      value={value}
      onValueChange={onChange}
      options={CHOICES.map((choice) => ({ value: choice, label: t(`units.${choice}`) }))}
    />
  );
}
