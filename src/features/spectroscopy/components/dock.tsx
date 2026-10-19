"use client";

import { Check, Shuffle, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";

import { useDockClearance } from "@/components/simulations/use-dock-clearance";
import {
  Action,
  Chip,
  ControlRow,
  Dock,
  IconButton,
  Slider,
  SwitchChip,
  Tooltip,
  cn,
  kickerClass,
} from "@horizon/toolkit/ui";

import { ELEMENT_IDS, type ElementId } from "../lib/model/atoms";
import { BENCH_RANGE, SEQUENCE_RANGE, verdict, type Verdict } from "../lib/model/scenes";
import { STAR_IDS, STARS } from "../lib/model/stars";
import { useSpectroscopy } from "../lib/store";
import { kelvin, signed } from "./format";
import { MysteryResultCard, OutcomeMark } from "./mystery-result";
import { VelocityLens } from "./velocity-lens";

/** A labelled row of chips that scrolls sideways on phones. */
function ChipRow({
  label,
  shown = label,
  fit = false,
  children,
}: {
  label: string;
  /** The visible label, when it differs from the spoken one; null shows none. */
  shown?: ReactNode;
  /** On phones, share the width evenly rather than scroll (every chip in sight). */
  fit?: boolean;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 items-center gap-2">
      {shown === null ? null : (
        <span className={cn(kickerClass, "flex shrink-0 items-center gap-1.5 not-md:hidden")}>
          {shown}
        </span>
      )}
      <div
        className={
          fit
            ? /* Phone-first: a grid of equal cells, the scrolling row from the desktop up. */
              "no-scrollbar grid min-w-0 flex-1 grid-cols-8 gap-0.5 md:-mx-1 md:flex md:items-center md:gap-1 md:overflow-x-auto md:px-1"
            : "no-scrollbar -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Element chips: which laboratory patterns to mark, or (on the bench) which gases to fill. */
function ElementChips({
  label,
  shown,
  fit = false,
  chosen,
  onToggle,
  result,
}: {
  label: string;
  shown?: ReactNode;
  fit?: boolean;
  chosen: readonly ElementId[];
  onToggle: (element: ElementId) => void;
  /** After a mystery is checked: what each chip turned out to be. */
  result?: (element: ElementId) => Verdict;
}) {
  const t = useTranslations("spectroscopy");
  return (
    <ChipRow label={label} shown={shown} fit={fit}>
      {ELEMENT_IDS.map((element, i) => {
        const on = chosen.includes(element);
        const outcome = result?.(element) ?? null;
        const name = `${element} · ${t(`elements.${element}`)}`;
        return (
          /* The symbol shows; the name is read with it (the row scrolls, so no tooltips). */
          <Chip
            key={element}
            selected={on}
            aria-pressed={on}
            aria-label={outcome ? `${name} · ${t(`dock.verdict.${outcome}`)}` : name}
            onClick={() => onToggle(element)}
            /* A checked answer marks its chips one after another. */
            style={{ "--i": i }}
            className={cn(
              "font-mono md:min-w-9",
              fit ? "min-w-0 px-0 md:px-3" : "min-w-11",
              outcome && "spectroscopy-verdict",
              outcome === "found" && "bg-accent/15 text-fg ring-1 ring-accent/70 ring-inset",
              outcome === "missed" &&
                "text-accent outline-1 -outline-offset-1 outline-accent/80 outline-dashed",
              outcome === "wrong" &&
                "text-danger line-through decoration-danger ring-1 ring-danger/60 ring-inset",
            )}
          >
            {outcome === "found" ? <Check aria-hidden className="size-3 text-accent" /> : null}
            {outcome === "wrong" ? <X aria-hidden className="size-3" /> : null}
            {element}
          </Chip>
        );
      })}
    </ChipRow>
  );
}

function VelocitySlider({ label, range }: { label: string; range: number }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const velocity = useSpectroscopy((s) => s.velocity);
  const text = (v: number) => t("dock.kms", { value: signed(f, v) });
  return (
    <ControlRow label={label} value={text(velocity)}>
      <Slider
        aria-label={label}
        min={-range}
        max={range}
        step={1}
        value={[velocity]}
        valueText={text}
        onValueChange={([v]) => useSpectroscopy.getState().setVelocity(v ?? 0)}
      />
    </ControlRow>
  );
}

/** The Sun and the stars: which star, its motion, Earth's air and the elements to compare. */
function SkyControls() {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const view = useSpectroscopy((s) => s.view);
  const star = useSpectroscopy((s) => s.star);
  const sequenceTemperature = useSpectroscopy((s) => s.sequenceTemperature);
  const air = useSpectroscopy((s) => s.air);
  const letters = useSpectroscopy((s) => s.letters);
  const compare = useSpectroscopy((s) => s.compare);
  const api = useSpectroscopy.getState;
  const [lo, hi] = SEQUENCE_RANGE;
  const toSlider = (T: number) => Math.round((Math.log(T / lo) / Math.log(hi / lo)) * 1000);
  const fromSlider = (v: number) => Math.round((lo * (hi / lo) ** (v / 1000)) / 50) * 50;
  return (
    <>
      {view === "stars" ? (
        <ChipRow label={t("dock.star")}>
          {STAR_IDS.map((id) => (
            <Chip
              key={id}
              selected={star === id}
              aria-pressed={star === id}
              onClick={() => api().setStar(id)}
              className="shrink-0"
            >
              {t(`stars.${id}`)}
              <span className="font-mono text-[10px] text-subtle">
                {STARS[id].type.split(" ")[0]}
              </span>
            </Chip>
          ))}
          <Chip
            selected={star === "sequence"}
            aria-pressed={star === "sequence"}
            onClick={() => api().setStar("sequence")}
            className="shrink-0"
          >
            {t("dock.anyStar")}
          </Chip>
        </ChipRow>
      ) : null}
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-[1fr_auto] md:items-end">
        <div
          className={cn(
            "grid gap-x-6 gap-y-1",
            view === "stars" && star === "sequence" && "md:grid-cols-2",
          )}
        >
          {view === "stars" && star === "sequence" ? (
            <ControlRow label={t("dock.temperature")} value={`${kelvin(f, sequenceTemperature)} K`}>
              <Slider
                aria-label={t("dock.temperature")}
                min={0}
                max={1000}
                step={1}
                value={[toSlider(sequenceTemperature)]}
                valueText={(v) => `${kelvin(f, fromSlider(v))} K`}
                onValueChange={([v]) => api().setSequenceTemperature(fromSlider(v ?? 0))}
              />
            </ControlRow>
          ) : null}
          <VelocitySlider
            label={view === "sun" ? t("dock.moveSun") : t("dock.velocity")}
            range={view === "sun" ? 600 : 300}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 pb-0.5">
          <SwitchChip on={air} onToggle={() => api().setAir(!air)}>
            {t("dock.air")}
          </SwitchChip>
          {view === "sun" ? (
            <SwitchChip on={letters} onToggle={() => api().setLetters(!letters)}>
              {t("dock.letters")}
            </SwitchChip>
          ) : null}
        </div>
      </div>
      <ElementChips
        fit
        label={t("dock.compare")}
        chosen={compare}
        onToggle={(e) => api().toggleCompare(e)}
      />
    </>
  );
}

/** Kirchhoff's bench: the light behind, the gas's temperature and amount, and what is in it. */
function BenchControls() {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const bench = useSpectroscopy((s) => s.bench);
  const api = useSpectroscopy.getState;
  const [lampLo, lampHi] = BENCH_RANGE.lamp;
  const lampToSlider = (K: number) =>
    K <= 0 ? 0 : 1 + Math.round((Math.log(K / lampLo) / Math.log(lampHi / lampLo)) * 999);
  const sliderToLamp = (v: number) =>
    v <= 0 ? 0 : Math.round((lampLo * (lampHi / lampLo) ** ((v - 1) / 999)) / 50) * 50;
  const [gasLo, gasHi] = BENCH_RANGE.gas;
  const gasToSlider = (K: number) =>
    Math.round((Math.log(K / gasLo) / Math.log(gasHi / gasLo)) * 1000);
  const sliderToGas = (v: number) => Math.round((gasLo * (gasHi / gasLo) ** (v / 1000)) / 50) * 50;
  const lampText = (K: number) => (K > 0 ? `${kelvin(f, K)} K` : t("dock.off"));
  const columnText = (c: number) =>
    t("dock.columnValue", { value: f.number(c, { maximumFractionDigits: 1 }) });
  const law =
    bench.elements.length === 0
      ? "continuum"
      : bench.lamp <= 0
        ? "emission"
        : bench.lamp > bench.gas
          ? "absorption"
          : bench.lamp < bench.gas
            ? "reversed"
            : "vanish";
  return (
    <>
      <ElementChips
        fit
        label={t("dock.gasElements")}
        chosen={bench.elements}
        onToggle={(e) => api().toggleGas(e)}
      />
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-3">
        <ControlRow label={t("dock.lamp")} value={lampText(bench.lamp)}>
          <Slider
            aria-label={t("dock.lamp")}
            min={0}
            max={1000}
            step={1}
            value={[lampToSlider(bench.lamp)]}
            valueText={(v) => lampText(sliderToLamp(v))}
            onValueChange={([v]) => api().patchBench({ lamp: sliderToLamp(v ?? 0) })}
          />
        </ControlRow>
        <ControlRow label={t("dock.gasTemperature")} value={`${kelvin(f, bench.gas)} K`}>
          <Slider
            aria-label={t("dock.gasTemperature")}
            min={0}
            max={1000}
            step={1}
            value={[gasToSlider(bench.gas)]}
            valueText={(v) => `${kelvin(f, sliderToGas(v))} K`}
            onValueChange={([v]) => api().patchBench({ gas: sliderToGas(v ?? 0) })}
          />
        </ControlRow>
        <ControlRow label={t("dock.column")} value={columnText(bench.column)}>
          <Slider
            aria-label={t("dock.column")}
            min={BENCH_RANGE.column[0]}
            max={BENCH_RANGE.column[1]}
            step={0.1}
            value={[bench.column]}
            valueText={columnText}
            onValueChange={([v]) => api().patchBench({ column: v ?? bench.column })}
          />
        </ControlRow>
      </div>
      <p aria-live="polite" className="text-xs text-pretty text-muted short:hidden">
        <span className="text-fg">{t(`kirchhoff.${law}.title`)}</span> ·{" "}
        {t(`kirchhoff.${law}.body`)}
      </p>
    </>
  );
}

/** A step's number beside its label. */
function StepLabel({ step, children }: { step: number; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full font-mono text-[10px] text-fg ring-1 ring-border-strong"
      >
        {step}
      </span>
      {children}
    </span>
  );
}

/** The deck: one chip per case, each marked once checked, and a fresh deal. */
function CaseStrip({ action }: { action?: ReactNode }) {
  const t = useTranslations("spectroscopy");
  const deck = useSpectroscopy((s) => s.deck);
  const index = useSpectroscopy((s) => s.caseIndex);
  const results = useSpectroscopy((s) => s.results);
  /* The guide puts up a case of its own; then no case of the deck is open. */
  const own = useSpectroscopy((s) => s.deck[s.caseIndex] === s.mystery);
  const api = useSpectroscopy.getState;
  const solved = results.filter((r) => r?.outcome === "solved").length;
  return (
    <div className="flex items-center justify-between gap-2">
      <ChipRow label={t("dock.cases")}>
        {deck.map((_, i) => {
          const outcome = results[i]?.outcome;
          const current = own && i === index;
          return (
            <Chip
              key={i}
              selected={current}
              aria-pressed={current}
              aria-label={
                outcome
                  ? `${t("dock.caseNumber", { number: i + 1 })} · ${t(`dock.outcome.${outcome}`)}`
                  : t("dock.caseNumber", { number: i + 1 })
              }
              onClick={() => api().setCase(i)}
              className="relative min-w-11 font-mono md:min-w-9"
            >
              {i + 1}
              {outcome ? <OutcomeMark outcome={outcome} small /> : null}
            </Chip>
          );
        })}
      </ChipRow>
      <div className="flex shrink-0 items-center gap-2">
        {results.some(Boolean) ? (
          <span className="font-mono text-xs text-muted tabular-nums not-md:hidden">
            {t("dock.solved", { solved, total: deck.length })}
          </span>
        ) : null}
        <Tooltip label={t("dock.newCases")} align="end">
          <IconButton aria-label={t("dock.newCases")} onClick={() => api().shuffleCases()}>
            <Shuffle className="size-4 md:size-3.5" />
          </IconButton>
        </Tooltip>
        {action}
      </div>
    </div>
  );
}

/**
 * A mystery in three steps: which elements (their lab lines marked under the spectrum), how
 * fast (one of their lines close up, the marker slid onto it), then check. The verdict names
 * the source.
 */
function MysteryControls() {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const compare = useSpectroscopy((s) => s.compare);
  const velocity = useSpectroscopy((s) => s.velocity);
  const result = useSpectroscopy((s) => s.result);
  const api = useSpectroscopy.getState;
  const answer = result?.answer;
  const verdicts = answer
    ? (element: ElementId) => verdict(answer, element, compare.includes(element))
    : undefined;
  const check = (className: string) => (
    <Action
      variant="solar"
      className={cn("min-h-10 shrink-0 px-6 text-xs md:min-h-8", className)}
      onClick={() => api().check()}
    >
      {t("dock.check")}
    </Action>
  );
  return (
    <>
      {/* A phone held sideways has room for one row of chrome: Check joins the cases. */}
      <CaseStrip action={result ? null : check("hidden short:inline-flex")} />
      {result ? <MysteryResultCard result={result} /> : null}
      <div className="grid items-start gap-x-8 gap-y-2.5 md:grid-cols-2 md:gap-y-4 short:grid-cols-2 short:gap-x-5">
        <div className="flex min-w-0 flex-col gap-1.5 md:gap-2">
          <p className="flex h-5 items-center text-xs text-muted">
            <StepLabel step={1}>{t("dock.answer")}</StepLabel>
          </p>
          <ElementChips
            label={t("dock.answer")}
            shown={null}
            fit
            chosen={compare}
            onToggle={(e) => api().toggleCompare(e)}
            {...(verdicts ? { result: verdicts } : {})}
          />
          <p className="text-xs text-pretty text-subtle not-md:hidden">{t("dock.answerHint")}</p>
        </div>
        {/* On a phone the verdict takes the lens's room: its card already gives the velocity. */}
        <div className={cn(result && "not-md:hidden")}>
          <VelocityLens step={<StepLabel step={2}>{t("dock.shift")}</StepLabel>} />
        </div>
      </div>
      {result ? null : (
        /* The answer as it stands, and the one action that scores it. */
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5 md:pt-3 short:hidden">
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <StepLabel step={3}>{t("dock.yourAnswer")}</StepLabel>
            <span className="truncate font-mono text-fg tabular-nums">
              {compare.length
                ? `${compare.join(" · ")} — ${t("dock.kms", { value: signed(f, velocity) })}`
                : "—"}
            </span>
          </p>
          {check("")}
        </div>
      )}
    </>
  );
}

/** The one bottom bar: whatever the current view lets the visitor change. */
export function SpectroscopyDock() {
  const view = useSpectroscopy((s) => s.view);
  const aside = useSpectroscopy((s) => s.panel !== "none" || s.selection !== null);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface);
  return (
    <Dock
      ref={surface}
      footerClassName={cn(aside && "not-md:hidden")}
      /* On phones the dock stops short of the spectrum and scrolls instead. */
      className="anim-rise scroll-thin flex max-h-[50dvh] flex-col gap-2.5 overflow-y-auto overscroll-contain md:max-h-none md:gap-3 md:overflow-visible short:max-h-[42dvh]"
    >
      {view === "kirchhoff" ? (
        <BenchControls />
      ) : view === "mystery" ? (
        <MysteryControls />
      ) : (
        <SkyControls />
      )}
    </Dock>
  );
}
