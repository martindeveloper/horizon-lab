import { useFormatter, useTranslations } from "next-intl";

import { durationQuantity, lengthQuantity, scaleMagnitude } from "@horizon/toolkit/science";

/** Domain labels and locale stay here; scale selection is shared and framework-free. */
export function usePhysicsFormat() {
  const fmt = useFormatter();
  const t = useTranslations("blackHole.units");
  const number = (n: number, digits: number) =>
    fmt.number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  function scaled(n: number, unit: string) {
    const quantity = scaleMagnitude(n);
    const value = number(quantity.value, quantity.digits);
    return quantity.scale ? t(quantity.scale, { value, unit }) : `${value} ${unit}`;
  }
  return {
    formatMass: (n: number) => scaled(n, "M☉"),
    formatMassShort: (n: number) =>
      `${fmt.number(n, { notation: "compact", maximumFractionDigits: 1 })} M☉`,
    formatLengthKm: (km: number) => {
      const q = lengthQuantity(km);
      return q.unit === "km" ? scaled(km, "km") : `${number(q.value, q.digits)} ${q.unit}`;
    },
    formatDuration: (seconds: number) => {
      const q = durationQuantity(seconds);
      const value = number(q.value, q.digits);
      return q.unit === "days" || q.unit === "years" ? t(q.unit, { value }) : `${value} ${q.unit}`;
    },
  };
}
