"use client";

import { useLocale } from "next-intl";

import { formatSignificant } from "@horizon/toolkit/science";
import { SegmentedControl } from "@horizon/toolkit/ui";

import { REFERENCES, compare, referenceBody, type Comparison } from "../lib/model/compare";
import type { RungId } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { useGiantsT } from "./format";

/** The figures compared, each with the words for more and for less. */
const MEASURES = ["width", "volume", "mass", "light"] as const satisfies (keyof Comparison)[];

/**
 * The body in focus against the Sun, Earth or the next smaller body: how many times wider,
 * their model volumes, masses and bolometric powers. The choice is kept as
 * the visitor climbs, so each step reads against the same yardstick.
 */
export function Compare({ id }: { id: RungId }) {
  const { t } = useGiantsT();
  const locale = useLocale();
  const reference = useGiants((s) => s.reference);
  const other = referenceBody(reference, id);
  const result = other ? compare(id, other) : null;
  const times = (value: number) => formatSignificant(value, locale, 3);
  return (
    <section className="flex flex-col gap-2" aria-label={t("compare.title")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs text-muted">{t("compare.title")}</h3>
        <SegmentedControl
          aria-label={t("compare.title")}
          options={REFERENCES.map((value) => ({ value, label: t(`compare.references.${value}`) }))}
          value={reference}
          onValueChange={(value) => useGiants.getState().setReference(value)}
        />
      </div>
      {result ? (
        <dl className="divide-y divide-border border-y border-border">
          {MEASURES.map((measure) => {
            const value = result[measure];
            if (value === undefined) return null;
            const more = value >= 1;
            return (
              <div key={measure} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="shrink-0 text-xs text-muted">{t(`compare.${measure}.label`)}</dt>
                <dd className="text-right font-mono text-[13px] text-fg tabular-nums">
                  {t(`compare.${measure}.${more ? "more" : "less"}`, {
                    value: times(more ? value : 1 / value),
                  })}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-xs text-muted">{t(`compare.itself.${reference}`)}</p>
      )}
      {result ? <p className="text-xs leading-relaxed text-muted">{t("compare.note")}</p> : null}
    </section>
  );
}
