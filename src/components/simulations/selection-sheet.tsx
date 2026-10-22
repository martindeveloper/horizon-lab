"use client";

import { Info } from "lucide-react";
import { useRef, type ReactNode } from "react";

import type { Card } from "@/lib/facts";
import { PanelHeader, cn, useFocusHandoff } from "@horizon/toolkit/ui";

/**
 * A selection's card: a bottom sheet on phones, a rail beside the scene on wide screens,
 * ending above the dock (`--hud-clear`). The first short figure leads; `footer` holds the
 * simulation's actions. `folded` keeps only the header and footer on phones. A card that is
 * open as the scene starts passes `takeFocus={false}`, so it does not take focus from the page.
 */
export function SelectionSheet({
  card,
  closeLabel,
  onClose,
  folded = false,
  takeFocus = true,
  details,
  footer,
}: {
  card: Card;
  closeLabel: string;
  onClose: () => void;
  folded?: boolean;
  takeFocus?: boolean;
  details?: ReactNode;
  footer?: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  useFocusHandoff(takeFocus ? root : NO_ELEMENT);
  const facts = card.facts.map((fact) => ({ ...fact, ...splitValue(fact.value) }));
  /* A short first figure leads the card; prose-length values stay in the list. */
  const lead = facts[0] && facts[0].main.length <= 16 ? facts[0] : null;
  const rows = lead ? facts.slice(1) : facts;
  return (
    <article
      ref={root}
      tabIndex={-1}
      className="glass-panel pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex max-h-[min(24rem,46dvh)] anim-sheet flex-col overflow-hidden rounded-t-xl outline-hidden md:inset-x-auto md:top-14 md:right-(--hud-gutter) md:bottom-auto md:max-h-[calc(100%-3.5rem-var(--hud-clear,5.5rem))] md:w-80 md:anim-rail md:rounded-lg"
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
        onClose={onClose}
        closeLabel={closeLabel}
        className="px-3.5 pt-3.5 md:px-4 md:pt-4"
      />
      <div
        className={cn(
          "scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4 md:px-4",
          folded && "not-md:hidden",
        )}
      >
        {lead ? (
          <div>
            <p className="text-xs text-fg-secondary">{lead.label}</p>
            <p className="mt-0.5 font-mono text-2xl tracking-tight text-fg-primary tabular-nums">
              {lead.main}
            </p>
            {lead.note ? (
              <p className="font-mono text-xs text-fg-secondary tabular-nums">{lead.note}</p>
            ) : null}
          </div>
        ) : null}
        {rows.length ? (
          <dl className="divide-y divide-border border-y border-border">
            {rows.map((fact) =>
              inline(fact) ? (
                <div key={fact.id} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="shrink-0 text-xs text-fg-secondary">{fact.label}</dt>
                  <dd className="text-right font-mono text-[13px] text-fg-primary tabular-nums">
                    {fact.main}
                    {fact.note ? (
                      <span className="block text-xs text-fg-secondary">{fact.note}</span>
                    ) : null}
                  </dd>
                </div>
              ) : (
                <div key={fact.id} className="py-2">
                  <dt className="text-xs text-fg-secondary">{fact.label}</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-fg-primary">
                    {fact.main}
                    {fact.note ? <span className="text-fg-secondary"> · {fact.note}</span> : null}
                  </dd>
                </div>
              ),
            )}
          </dl>
        ) : null}
        {card.body ? (
          <p className="text-sm leading-relaxed text-fg-primary/80">{card.body}</p>
        ) : null}
        {card.caution ? (
          <p className="flex gap-2 text-xs leading-relaxed text-fg-secondary">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {card.caution}
          </p>
        ) : null}
        {details}
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-3 md:px-4">
          {footer}
        </div>
      ) : null}
    </article>
  );
}

/** The ref a card that leaves focus be hands the focus hook. */
const NO_ELEMENT = { current: null };

/** "39.5 au · light-time 5.5 h" reads as a figure and its note. */
function splitValue(value: string) {
  const at = value.indexOf(" · ");
  return at < 0 ? { main: value } : { main: value.slice(0, at), note: value.slice(at + 3) };
}

/** Label and value (and its note) side by side when both fit the 20rem rail; prose stacks. */
function inline(fact: { label: string; main: string; note?: string }) {
  const value = Math.max(fact.main.length, fact.note?.length ?? 0);
  return fact.label.length * 6.5 + value * 7.8 < 250;
}
