"use client";

import { Columns2 } from "lucide-react";
import { useLocale } from "next-intl";

import type { Translate } from "@/lib/facts";
import { formatSignificant } from "@horizon/toolkit/science";
import { Action, SegmentedControl } from "@horizon/toolkit/ui";

import { REFERENCES, compare, referenceBody, type Comparison } from "../lib/model/compare";
import { rungNameKey } from "../lib/model/names";
import { RUNG_IDS, type RungId } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { useGiantsT } from "./format";

const MEASURES = ["width", "volume", "mass", "light"] as const satisfies (keyof Comparison)[];

/**
 * How `id` measures against `other`, printed a line a figure ("1,400 × wider"): the card's rows
 * and, side by side, the dock's line.
 */
export function comparisonLines(t: Translate, locale: string, id: RungId, other: RungId) {
  const result = compare(id, other);
  const times = (value: number) => formatSignificant(value, locale, 3);
  return MEASURES.flatMap((measure) => {
    const value = result[measure];
    if (value === undefined) return [];
    const more = value >= 1;
    const text = t(`compare.${measure}.${more ? "more" : "less"}`, {
      value: times(more ? value : 1 / value),
    });
    return [{ measure, text }];
  });
}

/**
 * The body in focus against the Sun, Earth, the next smaller body or any other: how many times
 * wider, their model volumes, masses and bolometric powers, and the way to stand the two side by
 * side at true scale. The choice is kept as the visitor climbs, so each step reads against the
 * same yardstick.
 */
export function Compare({ id }: { id: RungId }) {
  const { t } = useGiantsT();
  const locale = useLocale();
  const reference = useGiants((s) => s.reference);
  const otherBody = useGiants((s) => s.otherBody);
  const sideBySide = useGiants((s) => s.sideBySide);
  const other = referenceBody(reference, id, otherBody);
  const lines = other ? comparisonLines(t, locale, id, other) : null;
  const api = useGiants.getState;
  return (
    <section className="flex flex-col gap-2" aria-label={t("compare.title")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-ui text-fg-secondary">{t("compare.title")}</h3>
        <SegmentedControl
          aria-label={t("compare.title")}
          options={REFERENCES.map((value) => ({ value, label: t(`compare.references.${value}`) }))}
          value={reference}
          onValueChange={(value) => api().setReference(value)}
        />
      </div>
      {reference === "other" ? (
        <label className="flex items-center justify-between gap-3 text-ui text-fg-secondary">
          {t("compare.pick")}
          <select
            value={otherBody}
            onChange={(event) => {
              const picked = RUNG_IDS.find((rung) => rung === event.target.value);
              if (picked) api().setOtherBody(picked);
            }}
            className="min-w-0 rounded-control border border-border bg-surface-secondary px-2 py-1 text-body/5 text-fg-primary ui-focus"
          >
            {RUNG_IDS.map((rung) => (
              <option key={rung} value={rung}>
                {t(rungNameKey(rung))}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {lines ? (
        <dl className="divide-y divide-border border-y border-border">
          {lines.map(({ measure, text }) => (
            <div key={measure} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="shrink-0 text-ui text-fg-secondary">
                {t(`compare.${measure}.label`)}
              </dt>
              <dd className="text-right font-mono text-detail text-fg-primary tabular-nums">
                {text}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ui text-fg-secondary">{t(`compare.itself.${reference}`)}</p>
      )}
      {other ? (
        <Action
          className="w-full"
          aria-pressed={sideBySide}
          onClick={() => api().setSideBySide(!sideBySide)}
        >
          <Columns2 aria-hidden className="icon" />
          {t(sideBySide ? "compare.backToLadder" : "compare.sideBySide")}
        </Action>
      ) : null}
      {lines ? (
        <p className="text-ui leading-relaxed text-fg-secondary">{t("compare.note")}</p>
      ) : null}
    </section>
  );
}
