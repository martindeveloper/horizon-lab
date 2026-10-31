import type { Format, Translate } from "@/lib/facts";
import { yearSpan } from "@/lib/year-span";

import { isToday } from "../lib/model/timeline";

/**
 * Years ago on the timeline, in fixed decimals so the readout keeps its width as it moves: two
 * in billions, one in millions under ten, none otherwise; the shared unit rule (`yearSpan`).
 */
export function formatYearsAgo(t: Translate, f: Format, years: number, locale: string) {
  if (isToday(years)) return t("time.today");
  const { unit, value } = yearSpan(f, years, locale, {
    units: ["thousand", "million", "billion"],
    decimals: (unit, inUnit) => {
      switch (unit) {
        case "billion":
          return 2;
        case "million":
          return inUnit < 10 ? 1 : 0;
        default:
          return 0;
      }
    },
  });
  return t(`time.${unit}`, { value });
}
