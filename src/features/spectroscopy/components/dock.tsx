"use client";

import { Check, Shuffle, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";

import { useDockClearance } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
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

import { ELEMENT_IDS, ELEMENTS, type ElementId } from "../lib/model/atoms";
import { BENCH_RANGE, SEQUENCE_RANGE, verdict, type Verdict } from "../lib/model/scenes";
import { STAR_IDS, STARS } from "../lib/model/stars";
import { useSpectroscopy } from "../lib/store";
import { kelvin, signed } from "./format";
import { MysteryResultCard, OutcomeMark } from "./mystery-result";
import { PanelTitle, Tray } from "./tray";
import { VelocityLens } from "./velocity-lens";

/** A labelled row of chips that scrolls sideways. */
function ChipRow({
  label,
  shown = label,
  children,
}: {
  label: string;
  /** The visible label, when it differs from the spoken one; null shows none. */
  shown?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 items-center gap-2">
      {shown === null ? null : (
        <span className={cn(kickerClass, "flex shrink-0 items-center gap-1.5 not-md:hidden")}>
          {shown}
        </span>
      )}
      {/* A scrolling row clips both ways: the room above and below keeps a chip's corner badge
          and focus ring whole. */}
      <div className="no-scrollbar -mx-1 -my-1.5 flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-1.5">
        {children}
      </div>
    </div>
  );
}

/**
 * Element tiles: which laboratory patterns to lay over the spectrum, or (on the bench) which
 * gases to fill. A phone shows the symbols in one row; a desktop adds each name. Where
 * `preview` is on, resting the pointer or focus on a tile shows its lab lines before it is
 * marked.
 */
function ElementTiles({
  label,
  chosen,
  onToggle,
  preview = false,
  result,
}: {
  label: string;
  chosen: readonly ElementId[];
  onToggle: (element: ElementId) => void;
  preview?: boolean;
  /** After a mystery is checked: what each tile turned out to be. */
  result?: (element: ElementId) => Verdict;
}) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const api = useSpectroscopy.getState;
  const show = (element: ElementId | null) => {
    if (preview) api().setPreview(element);
  };
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-8 gap-1 md:gap-1.5"
      onPointerLeave={() => show(null)}
    >
      {ELEMENT_IDS.map((element, i) => {
        const on = chosen.includes(element);
        const outcome = result?.(element) ?? null;
        const name = t(`elements.${element}`);
        return (
          <button
            key={element}
            type="button"
            aria-pressed={on}
            aria-label={
              outcome
                ? `${element} · ${name} · ${t(`dock.verdict.${outcome}`)}`
                : `${element} · ${name}`
            }
            onClick={() => onToggle(element)}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") show(element);
            }}
            onFocus={() => show(element)}
            onBlur={() => show(null)}
            /* A checked answer turns its tiles over one after another. */
            style={{ "--i": i }}
            /* A cell of the periodic table: atomic number in the corner, the symbol large, the
               name and atomic weight beneath. */
            className={cn(
              "@container relative flex h-12 min-w-0 flex-col items-center justify-center rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
              "md:aspect-square md:h-auto md:max-h-24 md:gap-1 md:px-1.5 md:pt-3.5 md:pb-1.5",
              /* An unmarked element reads as a button: a hairline ring that brightens on hover.
                 A marked one takes the gold of its lines on the spectrum. */
              !outcome &&
                (on
                  ? "bg-accent/10 text-fg ring-1 ring-accent/60 ring-inset"
                  : "text-muted ring-1 ring-border-strong ring-inset hover:bg-fg/5 hover:text-fg hover:ring-fg/40"),
              outcome && "spectroscopy-verdict",
              outcome === "found" && "bg-accent/15 text-fg ring-1 ring-accent/70 ring-inset",
              outcome === "missed" &&
                "text-accent outline-1 -outline-offset-1 outline-accent/80 outline-dashed",
              outcome === "unseen" && "text-danger ring-1 ring-danger/60 ring-inset",
              outcome === null && result && !on && "text-subtle",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 left-1.5 font-mono text-[10px] leading-none tabular-nums md:top-1.5 md:left-2",
                on || outcome === "found" ? "text-accent" : "text-subtle",
              )}
            >
              {ELEMENTS[element].number}
            </span>
            <span
              className={cn(
                "text-base leading-none font-medium tracking-tight md:text-xl",
                outcome === "unseen" && "line-through decoration-danger",
              )}
            >
              {element}
            </span>
            {/* Name and weight only where the tile has room for them whole. */}
            <span aria-hidden className="hidden w-full text-center leading-tight @min-[4rem]:block">
              <span className="block truncate text-[10px] text-muted">{name}</span>
              <span className="block font-mono text-[10px] text-subtle tabular-nums">
                {f.number(ELEMENTS[element].atomicWeight, { maximumFractionDigits: 3 })}
              </span>
            </span>
            {outcome === "found" ? (
              <Check aria-hidden className="absolute top-1 right-1 size-3 text-accent" />
            ) : null}
            {outcome === "unseen" ? (
              <X aria-hidden className="absolute top-1 right-1 size-3" />
            ) : null}
          </button>
        );
      })}
    </div>
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
    <Tray
      panels={[
        {
          id: "source",
          label: view === "stars" ? t("dock.star") : t("dock.motion"),
          className: "md:col-span-6 lg:col-span-5",
          children: (
            <>
              <PanelTitle>{view === "stars" ? t("dock.star") : t("dock.motion")}</PanelTitle>
              {view === "stars" ? (
                <ChipRow label={t("dock.star")} shown={null}>
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
              {view === "stars" && star === "sequence" ? (
                <ControlRow
                  label={t("dock.temperature")}
                  value={`${kelvin(f, sequenceTemperature)} K`}
                >
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
              <div className="flex flex-wrap items-center gap-1">
                <SwitchChip on={air} onToggle={() => api().setAir(!air)}>
                  {t("dock.air")}
                </SwitchChip>
                {view === "sun" ? (
                  <SwitchChip on={letters} onToggle={() => api().setLetters(!letters)}>
                    {t("dock.letters")}
                  </SwitchChip>
                ) : null}
              </div>
            </>
          ),
        },
        {
          id: "compare",
          label: t("dock.compare"),
          className: "md:col-span-6 lg:col-span-7",
          children: (
            <>
              <PanelTitle>{t("dock.compare")}</PanelTitle>
              <ElementTiles
                preview
                label={t("dock.compare")}
                chosen={compare}
                onToggle={(e) => api().toggleCompare(e)}
              />
              <p className="hidden text-xs text-pretty text-subtle md:block">
                {t("dock.compareHint")}
              </p>
            </>
          ),
        },
      ]}
    />
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
      <Tray
        panels={[
          {
            id: "gas",
            label: t("dock.gasElements"),
            className: "md:col-span-5",
            children: (
              <>
                <PanelTitle>{t("dock.gasElements")}</PanelTitle>
                <ElementTiles
                  label={t("dock.gasElements")}
                  chosen={bench.elements}
                  onToggle={(e) => api().toggleGas(e)}
                />
              </>
            ),
          },
          {
            id: "conditions",
            label: t("dock.conditions"),
            className: "md:col-span-7",
            children: (
              <>
                <PanelTitle>{t("dock.conditions")}</PanelTitle>
                <div className="grid gap-x-5 gap-y-1 lg:grid-cols-3">
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
              </>
            ),
          },
        ]}
      />
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
function CaseStrip() {
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
      <CaseStrip />
      {result ? <MysteryResultCard result={result} /> : null}
      <Tray
        /* On a phone, Check rides in the tab row, beside the panels it scores. */
        action={result ? null : check("")}
        panels={[
          {
            id: "elements",
            label: t("dock.elementsTab"),
            className: "md:col-span-6",
            children: (
              <>
                <PanelTitle>
                  <StepLabel step={1}>{t("dock.answer")}</StepLabel>
                </PanelTitle>
                <ElementTiles
                  preview
                  label={t("dock.answer")}
                  chosen={compare}
                  onToggle={(e) => api().toggleCompare(e)}
                  {...(verdicts ? { result: verdicts } : {})}
                />
                <p className="hidden text-xs text-pretty text-subtle md:block">
                  {t("dock.answerHint")}
                </p>
              </>
            ),
          },
          {
            id: "speed",
            label: t("dock.speedTab"),
            className: "md:col-span-6",
            children: <VelocityLens step={<StepLabel step={2}>{t("dock.shift")}</StepLabel>} />,
          },
        ]}
      />
      {result ? null : (
        /* The answer as it stands, and the one action that scores it (a phone has Check above). */
        <div className="hidden items-center justify-between gap-3 md:flex">
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
  const aside = useSpectroscopy(asideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface);
  return (
    <Dock
      ref={surface}
      footerClassName={cn(aside && "not-md:hidden")}
      /* On a desktop the tray spans the stage, as the spectrum does; on phones the dock stops
         short of the spectrum and scrolls instead. */
      className="anim-rise scroll-thin flex max-h-[50dvh] flex-col gap-2.5 overflow-x-hidden overflow-y-auto overscroll-contain md:max-h-none md:max-w-none md:gap-3 md:overflow-visible short:max-h-[42dvh]"
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
