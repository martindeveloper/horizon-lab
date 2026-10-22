"use client";

import { useFormatter } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { OVERVIEW_AXIS, axisLeft, axisX, scaleLines } from "../lib/model/overview";
import type { Ruler } from "../lib/model/ruler";
import { OVERVIEW_MARGIN_PX, OVERVIEW_TOP_PX } from "../lib/parameters";
import { useGiants } from "../lib/store";
import { lengthText, useGiantsT } from "./format";

/** A scale line's value is left out when it would stand closer than this to the last one named, CSS px. */
const VALUE_GAP_PX = 58;

/** The lines on a stage `width` wide, each named unless it would crowd the last one named. */
function placeLines(ruler: Ruler, width: number) {
  let last = -Infinity;
  return scaleLines(ruler, OVERVIEW_AXIS).map((line) => {
    const x = axisX({ width }, line.share);
    const named = x - last >= VALUE_GAP_PX;
    if (named) last = x;
    return { ...line, x, named };
  });
}

/**
 * The overview's radius axis along the horizon: a faint gold line up from it at every round
 * radius in the ruler's units, its value beneath and the axis's title under those, on the axis
 * the engine's dots stand on (`overview.ts`), down to the baseline the engine publishes as
 * `--overview-baseline`. The bodies' names, the other axis, are the engine's labels.
 * Values that would crowd the last one named are left out, so a phone names every other line.
 */
export function OverviewScale() {
  const { t } = useGiantsT();
  const f = useFormatter();
  const shown = useGiants((s) => s.overview);
  const ruler = useGiants((s) => s.ruler);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const lines = useMemo(() => placeLines(ruler, width), [ruler, width]);
  return (
    <div
      ref={box}
      aria-hidden
      data-shown={shown}
      className="giants-scale"
      style={{
        top: OVERVIEW_TOP_PX,
        height: `calc(var(--overview-baseline) - ${OVERVIEW_TOP_PX}px)`,
      }}
    >
      {lines.map((line) => (
        <span
          key={`${line.unit}-${line.value}`}
          className="giants-scale-line"
          style={{ left: line.x }}
        >
          {line.named ? (
            <span className="giants-scale-value">{lengthText(t, f, line.value, line.unit)}</span>
          ) : null}
        </span>
      ))}
      <span
        className="giants-scale-title"
        style={{ left: axisLeft({ width }), right: OVERVIEW_MARGIN_PX }}
      >
        {t("overview.radius")}
      </span>
    </div>
  );
}
