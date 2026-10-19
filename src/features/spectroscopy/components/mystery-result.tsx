"use client";

import { ArrowRight, Check, Eye, Shuffle, Target, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Action, cn } from "@horizon/toolkit/ui";

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
          : "size-9 short:hidden",
        outcome === "solved" && "bg-accent text-accent-fg shadow-[0_0_18px_rgb(var(--solar)/0.45)]",
        outcome === "close" && "bg-surface text-accent ring-1 ring-accent/70",
        outcome === "missed" && "bg-surface text-danger ring-1 ring-danger/60",
      )}
    >
      <Icon className={small ? "size-2.5" : "size-4"} strokeWidth={small ? 3 : 2.5} />
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

/**
 * A checked mystery: the verdict at a glance, the source named, each half of the score, and
 * what to do next: line the markers up with the answer, or move on to the next case.
 */
export function MysteryResultCard({ result }: { result: MysteryResult }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const mystery = useSpectroscopy((s) => s.mystery);
  const deck = useSpectroscopy((s) => s.deck);
  const index = useSpectroscopy((s) => s.caseIndex);
  const results = useSpectroscopy((s) => s.results);
  const api = useSpectroscopy.getState;
  const reveal = useReveal(mystery);
  const own = deck[index] === mystery;
  /* The next case still open, after this one and round the deck. */
  const next = own
    ? deck.findIndex((_, k) => {
        const i = (index + 1 + k) % deck.length;
        return i !== index && !results[i];
      })
    : -1;
  const nextIndex = next < 0 ? -1 : (index + 1 + next) % deck.length;
  const { outcome } = result;
  return (
    <div
      role="status"
      key={`${index}-${outcome}`}
      className={cn(
        "anim-rise flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2.5 ring-1 ring-inset",
        outcome === "solved"
          ? "bg-accent/10 ring-accent/40"
          : outcome === "close"
            ? "bg-fg/5 ring-accent/25"
            : "bg-danger/5 ring-danger/30",
      )}
    >
      <OutcomeMark outcome={outcome} />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-medium text-fg">{t(`dock.outcome.${outcome}`)}</p>
        <p className="text-xs text-pretty text-muted">{reveal}</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
          <Score ok={result.found === result.total && result.wrong === 0}>
            {t("dock.elementsScore", {
              found: result.found,
              total: result.total,
              wrong: result.wrong,
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
      <div className="flex shrink-0 items-center gap-1.5 not-md:w-full">
        {outcome === "solved" ? null : (
          <Action
            variant="glass"
            className="min-h-10 px-4 text-xs not-md:flex-1 md:min-h-8"
            onClick={() => api().showAnswer()}
          >
            <Eye aria-hidden className="size-3.5" />
            {t("dock.showAnswer")}
          </Action>
        )}
        {own ? (
          <Action
            variant="solar"
            className="min-h-10 px-4 text-xs not-md:flex-1 md:min-h-8"
            onClick={() => (nextIndex < 0 ? api().shuffleCases() : api().setCase(nextIndex))}
          >
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
    </div>
  );
}
