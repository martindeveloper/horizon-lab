import { ArrowLeft, ChevronDown, ChevronUp, Info, ZoomIn } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Action, PanelHeader, cn, useFocusHandoff } from "@horizon/toolkit/ui";

import { DEFAULT_VIEW } from "../lib/model/views";
import { canCloseUp, useOrrery } from "../lib/store";
import { cardFor } from "./cards";

/** Facts and notes for the selected object, with the close-up entry. */
export function SelectionCard() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const selection = useOrrery((s) => s.selection);
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const elliptical = useOrrery((s) => s.show.elliptical);
  const unit = useOrrery((s) => s.distanceUnit);
  const locale = useLocale();
  const select = useOrrery((s) => s.select);
  const closeUp = useOrrery((s) => s.closeUp);
  const offerCloseUp = useOrrery(canCloseUp);
  /* On phones a close-up folds the card to a bar so the globe has the screen. */
  const [expanded, setExpanded] = useState(false);
  const now = useNow({ updateInterval: 60_000 });
  const root = useRef<HTMLElement>(null);
  useFocusHandoff(root);
  if (!selection) return null;
  const card = cardFor(t, f, selection, yearsAgo, elliptical, now, { unit, locale });
  const folded = closeUp && !expanded;
  const facts = card.facts.map((fact) => ({ ...fact, ...splitValue(fact.value) }));
  /* A short first figure leads the card; prose-length values stay in the list. */
  const lead = facts[0] && facts[0].main.length <= 16 ? facts[0] : null;
  const rows = lead ? facts.slice(1) : facts;
  const home = selection.kind === "galaxy" && selection.id === "sun";
  return (
    <article
      ref={root}
      tabIndex={-1}
      className="orrery-sheet glass-panel anim-sheet md:anim-rail pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-xl outline-hidden md:inset-x-auto md:top-14 md:right-(--hud-gutter) md:bottom-auto md:max-h-[calc(100%-3.5rem-var(--orrery-clear,5.5rem))] md:w-80 md:rounded-lg"
      aria-label={card.title}
    >
      <PanelHeader
        kicker={
          <span className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-solar" aria-hidden />
            {card.badge}
          </span>
        }
        title={<span className="mt-1 block text-xl leading-tight">{card.title}</span>}
        onClose={() => select(null)}
        closeLabel={t("hud.close")}
        className="px-3.5 pt-3.5 md:px-4 md:pt-4"
      />
      <div
        className={cn(
          "scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4 md:px-4",
          folded && "not-md:hidden",
        )}
      >
        {lead ? (
          <div>
            <p className="text-xs text-muted">{lead.label}</p>
            <p className="mt-0.5 font-mono text-2xl tracking-tight text-fg tabular-nums">
              {lead.main}
            </p>
            {lead.note ? (
              <p className="font-mono text-xs text-muted tabular-nums">{lead.note}</p>
            ) : null}
          </div>
        ) : null}
        {rows.length ? (
          <dl className="divide-y divide-border border-y border-border">
            {rows.map((fact) =>
              inline(fact) ? (
                <div key={fact.id} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="shrink-0 text-xs text-muted">{fact.label}</dt>
                  <dd className="text-right font-mono text-[13px] text-fg tabular-nums">
                    {fact.main}
                    {fact.note ? (
                      <span className="block text-xs text-muted">{fact.note}</span>
                    ) : null}
                  </dd>
                </div>
              ) : (
                <div key={fact.id} className="py-2">
                  <dt className="text-xs text-muted">{fact.label}</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-fg">
                    {fact.main}
                    {fact.note ? <span className="text-muted"> · {fact.note}</span> : null}
                  </dd>
                </div>
              ),
            )}
          </dl>
        ) : null}
        {card.body ? <p className="text-sm leading-relaxed text-fg/80">{card.body}</p> : null}
        {card.caution ? (
          <p className="flex gap-2 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {card.caution}
          </p>
        ) : null}
      </div>
      {closeUp || offerCloseUp || home ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-3 md:px-4">
          {closeUp ? (
            <Action className="flex-1" onClick={() => useOrrery.getState().leaveCloseUp()}>
              <ArrowLeft className="size-4" aria-hidden />
              {t("hud.leaveCloseUp")}
            </Action>
          ) : offerCloseUp ? (
            <Action className="flex-1" onClick={() => useOrrery.getState().enterCloseUp()}>
              <ZoomIn className="size-4" aria-hidden />
              {t("hud.closeUp")}
            </Action>
          ) : null}
          {closeUp ? (
            <Action
              variant="ghost"
              className="px-3 md:hidden"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t("hud.hideDetails") : t("hud.details")}
              {expanded ? (
                <ChevronDown className="size-4" aria-hidden />
              ) : (
                <ChevronUp className="size-4" aria-hidden />
              )}
            </Action>
          ) : null}
          {home ? (
            <Action
              className="flex-1"
              onClick={() => {
                const api = useOrrery.getState();
                api.select(null);
                api.setView(DEFAULT_VIEW);
              }}
            >
              {t("hud.home")}
            </Action>
          ) : null}
          {closeUp ? <p className="w-full text-xs text-muted">{t("hud.closeUpNote")}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

/** "39.5 au · light-time 5.5 h" reads as a figure and its note. */
function splitValue(value: string) {
  const at = value.indexOf(" · ");
  return at < 0 ? { main: value } : { main: value.slice(0, at), note: value.slice(at + 3) };
}

/** Label and value side by side when both fit the 20rem rail; prose stacks. */
function inline(fact: { label: string; main: string }) {
  return fact.label.length * 6.5 + fact.main.length * 7.8 < 250;
}
