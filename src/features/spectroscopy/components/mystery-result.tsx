"use client";

import { ArrowRight, Check, Eye, Shuffle, Target, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Action, IconButton, Tooltip, cn } from "@horizon/toolkit/ui";

import {
  mysteryTemperature,
  mysteryVelocity,
  spectralClass,
  type Mystery,
  type MysteryResult,
  type Outcome,
} from "../lib/model/scenes";
import { useSpectroscopy } from "../lib/store";
import { kelvin, signed } from "./format";

const ICONS = { solved: Check, close: Target, missed: X } as const;

/** An outcome's glyph: gold for solved, a gold ring for close, red for missed. */
export function OutcomeMark({ outcome, small = false }: { outcome: Outcome; small?: boolean }) {
  const Icon = ICONS[outcome];
  return (
    <span
      aria-hidden
      className={cn(
        "spectroscopy-stamp grid shrink-0 place-items-center rounded-full",
        small
          ? "absolute -top-0.5 -right-0.5 size-3.5 md:-top-1 md:-right-1"
          : "size-6 md:size-9 short:hidden",
        outcome === "solved" && "bg-accent text-accent-fg shadow-[0_0_18px_rgb(var(--solar)/0.45)]",
        outcome === "close" && "bg-surface text-accent ring-1 ring-accent/70",
        outcome === "missed" && "bg-surface text-danger ring-1 ring-danger/60",
      )}
    >
      <Icon className={small ? "size-2.5" : "size-3 md:size-4"} strokeWidth={small ? 3 : 2.5} />
    </span>
  );
}

/** The source, named: what it was, how hot, and how it moves. */
function useReveal(m: Mystery) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const temperature = kelvin(f, mysteryTemperature(m));
  const source =
    m.kind === "flame"
      ? t("mysteries.flame", { temperature })
      : m.kind === "cell"
        ? t("mysteries.cell", { temperature, lamp: kelvin(f, m.lamp) })
        : m.kind === "dwarf"
          ? t("mysteries.dwarf", { type: spectralClass(m.teff), temperature })
          : t("mysteries.giant", { star: t(`stars.${m.star}`), temperature });
  const v = mysteryVelocity(m);
  const speed = f.number(Math.abs(v));
  return v > 0
    ? `${source} · ${t("mysteries.receding", { value: speed })}`
    : v < 0
      ? `${source} · ${t("mysteries.approaching", { value: speed })}`
      : source;
}

/** One half of the score: a tick or a cross, then what it was. */
function Score({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <Check aria-hidden className="size-3.5 text-accent" strokeWidth={2.5} />
      ) : (
        <X aria-hidden className="size-3.5 text-danger" strokeWidth={2.5} />
      )}
      <span className={ok ? "text-fg" : "text-muted"}>{children}</span>
    </li>
  );
}

/** Where the deck goes after this case: the next one still open, round the deck, or none. */
function useNextCase() {
  const mystery = useSpectroscopy((s) => s.mystery);
  const deck = useSpectroscopy((s) => s.deck);
  const index = useSpectroscopy((s) => s.caseIndex);
  const results = useSpectroscopy((s) => s.results);
  /* The guide puts up a case of its own; then no case of the deck is open. */
  const own = deck[index] === mystery;
  const next = own
    ? deck.findIndex((_, k) => {
        const i = (index + 1 + k) % deck.length;
        return i !== index && !results[i];
      })
    : -1;
  return { own, nextIndex: next < 0 ? -1 : (index + 1 + next) % deck.length };
}

/**
 * What to do after a verdict: line the markers up with the answer, or move on to the next
 * case. `compact` is the phone's form, riding in the tray's tab row where Check was: the
 * answer as an icon, the way on in words.
 */
export function MysteryActions({
  result,
  compact = false,
}: {
  result: MysteryResult;
  compact?: boolean;
}) {
  const t = useTranslations("spectroscopy");
  const api = useSpectroscopy.getState;
  const { own, nextIndex } = useNextCase();
  const size = compact ? "min-h-9 px-3.5 text-xs" : "min-h-8 px-4 text-xs";
  const onward = () => (nextIndex < 0 ? api().shuffleCases() : api().setCase(nextIndex));
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {result.outcome === "solved" ? null : compact ? (
        <Tooltip label={t("dock.showAnswer")}>
          <IconButton aria-label={t("dock.showAnswer")} onClick={() => api().showAnswer()}>
            <Eye aria-hidden className="size-4" />
          </IconButton>
        </Tooltip>
      ) : (
        <Action variant="glass" className={size} onClick={() => api().showAnswer()}>
          <Eye aria-hidden className="size-3.5" />
          {t("dock.showAnswer")}
        </Action>
      )}
      {own ? (
        <Action variant="solar" className={size} onClick={onward}>
          {nextIndex < 0 ? (
            <>
              <Shuffle aria-hidden className="size-3.5" />
              {t("dock.newCases")}
            </>
          ) : (
            <>
              {t("dock.nextCase")}
              <ArrowRight aria-hidden className="size-3.5" />
            </>
          )}
        </Action>
      ) : null}
    </div>
  );
}

/**
 * A checked mystery: the verdict at a glance, the source named and each half of the score. A
 * desktop keeps the actions in the card; a phone has them in the tray's tab row below, so the
 * card stays a few lines and the spectrum keeps its room.
 */
export function MysteryResultCard({ result }: { result: MysteryResult }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const mystery = useSpectroscopy((s) => s.mystery);
  const index = useSpectroscopy((s) => s.caseIndex);
  const reveal = useReveal(mystery);
  const { outcome } = result;
  return (
    <div
      role="status"
      key={`${index}-${outcome}`}
      className={cn(
        "anim-rise flex items-start gap-x-2.5 rounded-md px-3 py-2 ring-1 ring-inset md:items-center md:gap-x-3 md:py-2.5",
        outcome === "solved"
          ? "bg-accent/10 ring-accent/40"
          : outcome === "close"
            ? "bg-fg/5 ring-accent/25"
            : "bg-danger/5 ring-danger/30",
      )}
    >
      <OutcomeMark outcome={outcome} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6 font-medium text-fg md:leading-5">
          {t(`dock.outcome.${outcome}`)}
        </p>
        <p className="line-clamp-2 text-xs text-pretty text-muted">{reveal}</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
          <Score ok={result.found === result.total && result.unseen === 0}>
            {t("dock.elementsScore", {
              found: result.found,
              total: result.total,
              unseen: result.unseen,
            })}
          </Score>
          <Score ok={result.velocityMatched}>
            {t("dock.velocityScore", {
              truth: signed(f, mysteryVelocity(mystery)),
              yours: signed(f, result.velocity),
            })}
          </Score>
        </ul>
      </div>
      <div className="not-md:hidden">
        <MysteryActions result={result} />
      </div>
    </div>
  );
}
