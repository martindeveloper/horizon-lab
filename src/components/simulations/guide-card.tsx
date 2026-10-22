"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { Action, IconButton, Tooltip, cn, uiMotion } from "@horizon/toolkit/ui";

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

/** Where the guide is: the step (from 0), the steps in all and, on a journey, the step's hold. */
export type GuideProgress = {
  step: number;
  total: number;
  /** A journey's wait before it moves on: `waiting` until the shot lands, then running or paused. */
  hold?: { seconds: number; state: "waiting" | "running" | "paused" } | undefined;
};

/**
 * Every simulation's guide card: one sheet of glass low and centred over the scene, like a film's
 * caption, with the step count above the words (`kicker`), the title and body (`GuideTitle`,
 * `GuideBody`, `GuideEquation` as children, rising in line by line with each step), a row of
 * gold segments for the steps (`progress`; the current one fills as it is reached, or over a
 * journey's hold) and the controls. The card keeps the words readable over a bright scene; held
 * sideways on a phone it moves to the corner. `className` places it (by default at the foot
 * of the stage) and `cardRef` reaches the panel, to measure it. `focusNext` gives the Next
 * button focus as the card opens.
 */
export function GuideCard({
  label,
  kicker,
  stepKey,
  live = true,
  progress,
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
  progress: GuideProgress;
  controls: GuideControls;
  className?: string | undefined;
  cardRef?: Ref<HTMLElement> | undefined;
  /** Give the Next button focus as the card opens. */
  focusNext?: boolean;
  children: ReactNode;
}) {
  const { previous, play, next, exit, extra } = controls;
  const nextRef = useRef<HTMLButtonElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusNext) nextRef.current?.focus({ preventScroll: true });
  }, [focusNext]);
  /* However the guide ends (Finish, the cross, Escape, another view), the card fades away. */
  useLayoutEffect(() => {
    const node = shell.current;
    return () => {
      if (node) leaveBehind(node);
    };
  }, []);
  /* A new step reads from its first line, wherever the last one was scrolled to. */
  useLayoutEffect(() => {
    if (words.current) words.current.scrollTop = 0;
  }, [stepKey]);
  /* Words below the fold: the foot fades and a slow arrow points on, until the end is in view. */
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = words.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    /* The observer reports each box once as it starts, then on every resize. */
    const resize = new ResizeObserver(check);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, [stepKey]);
  return (
    <div
      ref={shell}
      className={cn(
        "pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[60]",
        className,
      )}
    >
      <section
        ref={cardRef}
        aria-label={label}
        className="guide-card glass glass-edge pointer-events-auto relative mx-auto flex max-w-xl anim-rise flex-col items-center rounded-xl px-4 pt-3.5 pb-3 text-center md:px-6 md:pt-5 md:pb-4 short:mx-0 short:max-w-xs short:items-start short:px-3 short:pt-2.5 short:pb-2 short:text-left"
      >
        <p className="font-mono text-[10px] tracking-[0.14em] text-fg-tertiary uppercase tabular-nums">
          {kicker}
        </p>
        <div className="relative mt-1.5 w-full short:mt-1">
          <div
            ref={words}
            data-more={more || undefined}
            className="guide-words scroll-thin max-h-[min(13rem,32dvh)] w-full overflow-x-hidden overflow-y-auto overscroll-contain short:max-h-[38dvh]"
            aria-live={live ? "polite" : undefined}
            aria-atomic={live ? true : undefined}
          >
            <div key={stepKey} className="guide-step">
              {children}
            </div>
          </div>
          {/* A pointer's shortcut down the words; keys and wheels scroll the words themselves. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            data-shown={more || undefined}
            className="guide-more absolute inset-x-0 -bottom-1 mx-auto flex size-6 items-center justify-center text-fg-primary"
            onClick={() => {
              const el = words.current;
              el?.scrollBy({
                top: el.clientHeight * 0.7,
                behavior: prefersReducedMotion() ? "instant" : "smooth",
              });
            }}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <GuideSegments {...progress} />
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

/**
 * The closing card's likeness, left in its place to fade and sink away: the card itself unmounts
 * with its guide, whose store has already moved on. Taken as React removes the card and shown
 * only once it has really gone (Strict Mode's rehearsal keeps it), frozen as it was, inert and
 * hidden from assistive technology.
 */
function leaveBehind(node: HTMLElement) {
  const host = node.parentElement;
  if (!host) return;
  const ghost = node.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) return;
  const scrolled = node.querySelector(".guide-words")?.scrollTop ?? 0;
  const fill = node.querySelector(".guide-fill");
  const filled = fill ? getComputedStyle(fill).transform : "none";
  queueMicrotask(() => {
    if (node.isConnected || !host.isConnected) return;
    ghost.classList.add("guide-leaving");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.querySelector<HTMLElement>(".guide-fill")?.style.setProperty("transform", filled);
    host.append(ghost);
    const words = ghost.querySelector(".guide-words");
    if (words) words.scrollTop = scrolled;
    const card = ghost.firstElementChild;
    const still = prefersReducedMotion();
    const leave = card?.animate(
      still
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(10px) scale(0.985)" },
          ],
      { ...uiMotion(card, "control", "exit"), fill: "forwards" },
    );
    if (!leave) return ghost.remove();
    leave.finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
  });
}

function GuideSegments({ step, total, hold }: GuideProgress) {
  return (
    <div aria-hidden className="mt-3 flex w-full max-w-48 gap-1 short:mt-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-fg-primary/15">
          {i < step ? <span className="block h-full bg-solar/60" /> : null}
          {i === step ? (
            <span
              key={step}
              className="guide-fill block h-full bg-solar"
              data-state={hold?.state ?? "running"}
              data-timed={hold ? true : undefined}
              style={hold ? { animationDuration: `${hold.seconds}s` } : undefined}
            />
          ) : null}
        </span>
      ))}
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
      className="font-display text-xl font-medium tracking-tight text-balance text-fg-primary outline-hidden md:text-2xl short:text-base"
    >
      {children}
    </h2>
  );
}

export function GuideBody({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 text-sm leading-relaxed text-pretty text-fg-secondary short:mt-0.5 short:text-xs">
      {children}
    </p>
  );
}

/** A formula under the body, in the mono face, scrolling sideways when it is long. */
export function GuideEquation({ children }: { children: ReactNode }) {
  return (
    <p className="scroll-thin mt-2 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg-primary tabular-nums md:text-sm">
      {children}
    </p>
  );
}
