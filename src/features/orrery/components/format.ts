import type { Format, Translate } from "@/lib/facts";

import { isToday } from "../lib/model/timeline";

export function formatYearsAgo(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) =>
    f.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (isToday(years)) return t("time.today");
  if (years < 1e6) return t("time.thousand", { value: n(years / 1e3, 0) });
  if (years < 1e9) return t("time.million", { value: n(years / 1e6, years / 1e6 < 10 ? 1 : 0) });
  return t("time.billion", { value: n(years / 1e9, 2) });
}
