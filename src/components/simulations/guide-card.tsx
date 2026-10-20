"use client";

import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

import { Action, IconButton, Tooltip, cn } from "@horizon/toolkit/ui";

/** The guide's buttons, in one row: back, play, on (with `extra` beside it), and out. */
export type GuideControls = {
  /** Back a step; `disabled` on the first keeps focus where it is (aria-disabled). */
  previous?: { label: string; disabled: boolean; onClick: () => void } | undefined;
  /** Whatever the guide runs by itself: a clock, the journey moving on. Always stoppable (WCAG 2.2.2). */
  play?: { label: string; playing: boolean; onClick: () => void } | undefined;
  next: {
    label: string;
    onClick: () => void;
    last?: boolean | undefined;
  };
  exit: { label: string; onClick: () => void };
  /** Beside Next: a way on, such as the Orrery's to Deep Field at its last step. */
  extra?: ReactNode;
};

/**
 * Lighter than panel glass, so the scene reads through it: the panel's tint at 60 % under the
 * same blur, in either theme. Set as the material's variable, so browsers without backdrop
 * blur still get the opaque fallback.
 */
const VEIL = {
  "--glass-bg": "color-mix(in srgb, var(--panel-bg) 60%, transparent)",
} as CSSProperties;

/**
 * Every simulation's guide card: one sheet of glass low and centred over the scene, like a film's
 * caption, with the step count above the words (`kicker`), the title and body (`GuideTitle`,
 * `GuideBody`, `GuideEquation` as children), an optional `hold` under them (the time left on
 * a shot) and the controls. The card keeps the words readable over a bright scene; held
 * sideways on a phone it moves to the corner. `className` places it (by default at the foot
 * of the stage) and `cardRef` reaches the panel, to measure it. `focusNext` gives the Next
 * button focus as the card opens.
 */
export function GuideCard({
  label,
  kicker,
  stepKey,
  live = true,
  hold,
  controls,
  className,
  cardRef,
  focusNext = false,
  children,
}: {
  label: string;
  kicker: ReactNode;
  /** Changes with the step, so its words fade in afresh. */
  stepKey: string | number;
  /** Announce each step through one polite live region (off when the caller moves focus). */
  live?: boolean;
  hold?: ReactNode;
  controls: GuideControls;
  className?: string | undefined;
  cardRef?: Ref<HTMLElement> | undefined;
  /** Give the Next button focus as the card opens. */
  focusNext?: boolean;
  children: ReactNode;
}) {
  const { previous, play, next, exit, extra } = controls;
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusNext) nextRef.current?.focus({ preventScroll: true });
  }, [focusNext]);
  return (
    <div
      className={cn(
        "pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[60]",
        className,
      )}
    >
      <section
        ref={cardRef}
        aria-label={label}
        style={VEIL}
        className="glass glass-edge anim-rise pointer-events-auto relative mx-auto flex max-w-xl flex-col items-center rounded-xl px-4 pt-3.5 pb-3 text-center md:px-6 md:pt-5 md:pb-4 short:mx-0 short:max-w-xs short:items-start short:px-3 short:pt-2.5 short:pb-2 short:text-left"
      >
        <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase tabular-nums">
          {kicker}
        </p>
        <div
          className="mt-1.5 max-h-[min(13rem,32dvh)] w-full overflow-y-auto overscroll-contain short:mt-1 short:max-h-[38dvh]"
          aria-live={live ? "polite" : undefined}
          aria-atomic={live ? true : undefined}
        >
          <div key={stepKey} className="anim-fade">
            {children}
          </div>
        </div>
        {hold}
        <div className="mt-3 flex items-center gap-2 short:mt-2">
          {previous ? (
            <IconButton
              aria-label={previous.label}
              aria-disabled={previous.disabled}
              onClick={() => {
                if (!previous.disabled) previous.onClick();
              }}
              className="aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </IconButton>
          ) : null}
          {play ? (
            <Tooltip label={play.label}>
              <IconButton aria-label={play.label} active={play.playing} onClick={play.onClick}>
                {play.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </IconButton>
            </Tooltip>
          ) : null}
          {extra}
          <Action ref={nextRef} className="px-4" onClick={next.onClick}>
            {next.label}
            {next.last ? null : <ChevronRight className="-mr-1 size-4" />}
          </Action>
          <Tooltip label={exit.label}>
            <IconButton aria-label={exit.label} onClick={exit.onClick}>
              <X className="size-4" />
            </IconButton>
          </Tooltip>
        </div>
      </section>
    </div>
  );
}

/** The step's title; focusable from script, so a caller can move focus to each new step. */
export function GuideTitle({
  ref,
  children,
}: {
  ref?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className="font-display text-xl font-medium tracking-tight text-balance text-fg outline-hidden md:text-2xl short:text-base"
    >
      {children}
    </h2>
  );
}

export function GuideBody({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted short:mt-0.5 short:text-xs">
      {children}
    </p>
  );
}

/** A formula under the body, in the mono face, scrolling sideways when it is long. */
export function GuideEquation({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg tabular-nums md:text-sm">
      {children}
    </p>
  );
}
