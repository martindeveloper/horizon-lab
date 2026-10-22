"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  coachLeader,
  keptOf,
  settleCoach,
  type CoachObstacle,
  type CoachSettled,
  type CoachPlacement,
  type CoachRect,
} from "./coach-model";
import { isSceneShortcut } from "./keyboard";
import { uiMotion } from "./motion";
import { cn } from "./utils";

/** A control the coach may point at carries `data-coach="<id>"`. */
export const COACH_TARGET = "data-coach";
/** The button that opens the coach: a press on it is not a press outside. */
export const COACH_OPENER = "data-coach-opener";
/** What the card keeps clear of by default: the HUD's glass surfaces. */
export const COACH_AVOID = '[class*="glass"], .lesson-card';

/** Room between the card, its target and the stage's edges, px. */
const GAP = 12;
/** The ring stands this far outside its target, px. */
const RING_PAD = 5;

export type CoachMarkProps = {
  /** Names the card ("Help"). */
  label: string;
  /** The step count above the title ("2 / 7"). */
  kicker: ReactNode;
  title: ReactNode;
  body: ReactNode;
  /** The step, from 0, and the steps in all. */
  step: number;
  total: number;
  /** What the step points at, by `data-coach` id: the first one on screen. None: the card alone. */
  targets?: readonly string[] | undefined;
  /** Presses the target (or its first button) as the step finds it, to open a picker, and again as the step ends if it is still open. */
  press?: boolean | undefined;
  /** Where the targets are looked for and the card is drawn: the nearest ancestor matching this selector. */
  scope: string;
  /** What the card keeps clear of, anywhere on the page: `COACH_AVOID` and whatever else covers the stage. */
  avoid?: string | undefined;
  labels: { previous: string; next: string; finish: string; close: string };
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Where focus goes when the coach closes with focus inside it. */
  returnFocus?: () => HTMLElement | null | undefined;
};

type Found = { element: HTMLElement; rect: CoachRect; radius: string };

/** On screen: a box, and not hidden by `visibility` (which keeps the box). */
const visible = (box: DOMRect, style: CSSStyleDeclaration) =>
  box.width > 0 && box.height > 0 && style.visibility !== "hidden";

/** The first of `ids` on screen in `root`, and its box relative to the root's. */
function findTarget(root: HTMLElement, ids: readonly string[]): Found | null {
  const origin = root.getBoundingClientRect();
  for (const id of ids) {
    for (const element of root.querySelectorAll<HTMLElement>(`[${COACH_TARGET}="${id}"]`)) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!visible(box, style)) continue;
      return {
        element,
        rect: {
          left: box.left - origin.left,
          top: box.top - origin.top,
          width: box.width,
          height: box.height,
        },
        radius: style.borderRadius,
      };
    }
  }
  return null;
}

/** The target and what it has open (a picker's list, a panel: `aria-controls`). */
function litBy(target: HTMLElement) {
  const owners = [target, ...target.querySelectorAll("[aria-controls]")];
  const opened = owners.flatMap((owner) =>
    (owner.getAttribute("aria-controls") ?? "")
      .split(" ")
      .map((id) => (id === "" ? null : document.getElementById(id)))
      .filter((el): el is HTMLElement => el !== null),
  );
  return [target, ...opened];
}

/** Whether `node` is in the target or in what it has open. */
const within = (target: HTMLElement, node: Element) =>
  litBy(target).some((lit) => lit.contains(node));

/**
 * The surfaces up as a step begins, before its cues run: the tour plays them after the coach's
 * own effects, so what is new since was brought up by the step.
 */
function useStepStart(root: HTMLElement | null, avoid: string, step: number) {
  const before = useRef<ReadonlySet<Element>>(new Set());
  useEffect(() => {
    if (root) before.current = new Set(root.querySelectorAll(avoid));
  }, [root, avoid, step]);
  return before;
}

/** What the step is about: the target, what it has open, and the surfaces the step brought up. */
function keptBy(
  root: HTMLElement,
  avoid: string,
  before: ReadonlySet<Element>,
  target: HTMLElement | null,
) {
  const brought = [...root.querySelectorAll(avoid)].filter((el) => !before.has(el));
  return [...(target ? litBy(target) : []), ...brought];
}

/** How far the HUD around a step quiets down, and how quickly. */
const QUIET_OPACITY = 0.35;

/**
 * The HUD's surfaces in `root` (`avoid`) that a step is not about: every outermost one, except
 * that a surface holding something `lit` keeps that bright and quiets only its other parts (a
 * toolbar's other buttons), looking through `display: contents` wrappers, and what is inside
 * the lit stays as it is.
 */
function quietAround(root: HTMLElement, avoid: string, lit: readonly Element[]) {
  const isLit = (el: Element) => lit.some((on) => on.contains(el));
  const holdsLit = (el: Element) => lit.some((on) => el.contains(on));
  const surfaces = [...root.querySelectorAll(avoid)];
  const quiet = new Set<Element>();
  const visit = (el: Element) => {
    for (const child of el.children) {
      if (isLit(child)) continue;
      if (holdsLit(child) || getComputedStyle(child).display === "contents") visit(child);
      else quiet.add(child);
    }
  };
  for (const surface of surfaces) {
    if (isLit(surface) || surfaces.some((outer) => outer !== surface && outer.contains(surface)))
      continue;
    if (holdsLit(surface)) visit(surface);
    else quiet.add(surface);
  }
  return quiet;
}

/**
 * Quiets the HUD round the step while the coach is open: the ringed control, what it has open,
 * whatever surface the step brought up (a card, a panel) and the scene stay as they are; the
 * rest of the HUD fades back. A web animation over each surface's own styles, so no class or
 * animation of the page's is touched; the fade eases both ways (at once under reduced motion)
 * and every surface comes back as the coach closes. `layout` changes when the page does.
 */
function useQuietHud(
  root: HTMLElement | null,
  avoid: string,
  target: HTMLElement | null,
  before: { current: ReadonlySet<Element> },
  layout: unknown,
) {
  const faded = useRef(new Map<Element, Animation>());
  useEffect(() => {
    if (!root) return;
    const now = quietAround(root, avoid, keptBy(root, avoid, before.current, target));
    const fade = (el: Element) =>
      el.animate([{ opacity: 1 }, { opacity: QUIET_OPACITY }], {
        ...uiMotion(el, "control"),
        fill: "forwards",
      });
    for (const [el, animation] of faded.current) {
      if (now.has(el)) continue;
      animation.reverse();
      animation.finished.then(
        () => animation.cancel(),
        () => {},
      );
      faded.current.delete(el);
    }
    for (const el of now) if (!faded.current.has(el)) faded.current.set(el, fade(el));
  }, [root, avoid, target, before, layout]);
  useEffect(() => {
    const all = faded.current;
    return () => {
      for (const animation of all.values()) animation.cancel();
      all.clear();
    };
  }, []);
}

/** A box's place in the root, rounded, as a key that changes only when the layout does. */
const keyOf = (rects: readonly CoachObstacle[]) =>
  rects
    .map(
      (r) =>
        `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)},${r.kind ?? ""}`,
    )
    .join(" ");

/** What the coach reads of the page each frame: the target, the surfaces to keep clear of, the stage. */
type Layout = {
  /** The step it was read for: until the new step's is read, the last step's stands. */
  step: number;
  found: (Found & { step: number }) | null;
  obstacles: readonly CoachObstacle[];
  stage: { width: number; height: number };
};

/**
 * Follows the step's target and the surfaces to keep clear of while the coach is open, a frame
 * at a time (panels slide in, docks wrap): only a change re-renders. Each surface is weighed by
 * what covering it costs (`COVER`): what the step is about and the page's bars over the stage
 * most, the HUD the step quiets little. Nothing runs once the coach closes.
 */
function useLayout(
  root: HTMLElement | null,
  card: { current: HTMLElement | null },
  ids: readonly string[],
  avoid: string,
  step: number,
  before: { current: ReadonlySet<Element> },
) {
  const [layout, setLayout] = useState<Layout>({
    step: -1,
    found: null,
    obstacles: [],
    stage: { width: 0, height: 0 },
  });
  const key = ids.join(" ");
  useEffect(() => {
    if (!root) return;
    let frame = 0;
    let last = "";
    let lastTarget: HTMLElement | null = null;
    const look = () => {
      const found = key ? findTarget(root, key.split(" ")) : null;
      const origin = root.getBoundingClientRect();
      const kept = keptBy(root, avoid, before.current, found?.element ?? null);
      const obstacles: CoachObstacle[] = [];
      for (const element of document.querySelectorAll(avoid)) {
        if (card.current?.contains(element) || element.contains(root)) continue;
        const box = element.getBoundingClientRect();
        if (!visible(box, getComputedStyle(element))) continue;
        obstacles.push({
          left: box.left - origin.left,
          top: box.top - origin.top,
          width: box.width,
          height: box.height,
          /* What the step is about, and the page's bars over the stage (which would hide the
             callout), are never covered; the HUD the step quiets may be. */
          kind: !root.contains(element)
            ? "over"
            : kept.some((on) => on.contains(element))
              ? "kept"
              : "quiet",
        });
      }
      const stage = { width: origin.width, height: origin.height };
      const now = `${keyOf(found ? [found.rect] : [])}|${keyOf(obstacles)}|${stage.width}x${stage.height}`;
      if (now !== last || (found?.element ?? null) !== lastTarget) {
        last = now;
        lastTarget = found?.element ?? null;
        setLayout({ step, found: found && { ...found, step }, obstacles, stage });
      }
      frame = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(frame);
  }, [root, card, key, avoid, step, before]);
  const read = layout.step === step;
  return { ...layout, read, found: read ? layout.found : null };
}

/**
 * A guided tour's coach mark, a layer of its own over the scene: no veil, a gold ring on the
 * control the step is about, a thin gold leader from it to a small gold-edged callout (never one
 * of the HUD's glass panels: solid, the page's colour warmed with gold, in either theme) that
 * stands where it covers least: never its target or what the step is about, the HUD the step
 * quiets before the page's bars (`avoid`, `COVER`). The callout's top edge is the tour's horizon:
 * gold fills along it, step by step, a sun at its head. Drawn in the `scope` ancestor. Escape,
 * the close button and a press outside the callout, the target and what the target has open close
 * it; the arrow keys step. Next takes focus as it opens; each step is announced politely.
 */
export function CoachMark({
  label,
  kicker,
  title,
  body,
  step,
  total,
  targets = [],
  press = false,
  scope,
  avoid = COACH_AVOID,
  labels,
  onPrevious,
  onNext,
  onClose,
  returnFocus,
}: CoachMarkProps) {
  const home = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const bodyId = useId();
  const before = useStepStart(root, avoid, step);
  const { read, found, obstacles, stage } = useLayout(root, card, targets, avoid, step, before);
  useQuietHud(root, avoid, found?.element ?? null, before, obstacles);
  const last = step >= total - 1;

  useLayoutEffect(() => {
    setRoot(home.current?.parentElement?.closest<HTMLElement>(scope) ?? document.body);
  }, [scope]);

  /* The card's size, for placing it. */
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  /* A step that presses its target opens it once found, and closes it again as the step ends. */
  const pressed = useRef<HTMLElement | null>(null);
  const target = found?.element ?? null;
  useEffect(() => {
    if (!press || !target || pressed.current) return;
    const button = target.matches("button, [role=button]")
      ? target
      : target.querySelector<HTMLElement>("button, [role=button]");
    if (!button) return;
    pressed.current = button;
    button.click();
  }, [press, target]);
  useEffect(
    () => () => {
      const el = pressed.current;
      pressed.current = null;
      if (el?.getAttribute("aria-expanded") === "true") el.click();
    },
    [step],
  );

  const handlers = useRef({ onPrevious, onNext, onClose, target, returnFocus });
  useEffect(() => {
    handlers.current = { onPrevious, onNext, onClose, target, returnFocus };
  });

  /* Next takes focus as the coach opens; closing hands focus back if it was inside. */
  useEffect(() => {
    if (!root) return;
    const el = card.current;
    next.current?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body && !el?.contains(active)) return;
      handlers.current.returnFocus?.()?.focus({ preventScroll: true });
    };
  }, [root]);

  /*
   * The card holds still under a press: what the press does on its way down (a picker it
   * leaves closes, the HUD moves) must not carry the button away before the click lands.
   */
  const [held, setHeld] = useState<CoachPlacement | null>(null);
  const shown = useRef<CoachPlacement | null>(null);

  /* Escape closes from anywhere, the arrows step from the scene or the card; a press outside the card, its target and the opener closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSceneShortcut(e, { controls: true })) return;
      const inCard = e.target instanceof Node && !!card.current?.contains(e.target);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handlers.current.onClose();
      } else if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        (inCard || isSceneShortcut(e))
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "ArrowRight") handlers.current.onNext();
        else handlers.current.onPrevious();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const node = e.target instanceof Element ? e.target : null;
      if (!node) return;
      if (card.current?.contains(node)) {
        setHeld(shown.current);
        return;
      }
      if (node.closest(`[${COACH_OPENER}]`)) return;
      if (handlers.current.target && within(handlers.current.target, node)) return;
      handlers.current.onClose();
    };
    /* Let go after the click, which follows the release within the same frame. */
    let release = 0;
    const onRelease = () => {
      cancelAnimationFrame(release);
      release = requestAnimationFrame(() => setHeld(null));
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointerup", onRelease, true);
    window.addEventListener("pointercancel", onRelease, true);
    return () => {
      cancelAnimationFrame(release);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointerup", onRelease, true);
      window.removeEventListener("pointercancel", onRelease, true);
    };
  }, []);

  const rect = found?.rect ?? null;
  const ring = rect && {
    left: rect.left - RING_PAD,
    top: rect.top - RING_PAD,
    width: rect.width + 2 * RING_PAD,
    height: rect.height + 2 * RING_PAD,
  };
  /*
   * The callout finds its place once the step's page is read (until then it stays where the
   * last step left it), then keeps it while that still holds; a new step or target finds its own.
   */
  const [settled, setSettled] = useState<CoachSettled<HTMLElement> | null>(null);
  const settling = settleCoach({
    settled,
    step,
    read,
    targetId: target,
    target: ring,
    card: cardSize,
    stage,
    obstacles,
    gap: GAP,
  });
  if (settling.settle) setSettled(settling.settle);
  const place = held ?? settling.place;
  useEffect(() => {
    shown.current = place;
  });
  const leader =
    place && ring ? coachLeader({ ...place, ...cardSize }, ring, keptOf(obstacles)) : null;
  /** How far along the horizon the tour has come. */
  const reached = `${((step + 1) / total) * 100}%`;

  const layer = (
    <>
      {ring ? (
        <div
          aria-hidden
          className="coach-ring pointer-events-none absolute z-[80]"
          style={{ ...ring, borderRadius: `calc(${found?.radius ?? "0px"} + ${RING_PAD}px)` }}
        />
      ) : null}
      {leader ? (
        <svg
          key={step}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[80] size-full"
        >
          <polyline
            className="coach-leader"
            points={leader.map(({ x, y }) => `${x},${y}`).join(" ")}
          />
          <circle className="coach-leader-end" cx={leader[0]!.x} cy={leader[0]!.y} r={2.5} />
        </svg>
      ) : null}
      <section
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-describedby={bodyId}
        data-side={place?.side}
        style={place ? { left: place.left, top: place.top } : { visibility: "hidden" }}
        className="coach-card pointer-events-auto absolute z-[81] w-[min(19rem,calc(100%-1.5rem))] rounded-lg px-4 pt-3 pb-1.5 md:pb-2"
      >
        {/* The horizon: gold fills along the top edge as the tour goes on, a sun at its head. */}
        <span aria-hidden className="coach-horizon">
          <span className="coach-horizon-fill" style={{ width: reached }} />
          <span className="coach-horizon-sun" style={{ left: reached }} />
        </span>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-accent uppercase tabular-nums">
            {kicker}
          </p>
          <button
            type="button"
            aria-label={labels.close}
            title={labels.close}
            onClick={onClose}
            className="coach-quiet -mr-2.5 ml-auto size-11 md:size-8"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="-mt-2 md:-mt-1" aria-live="polite" aria-atomic>
          <div key={step} className="anim-fade">
            <h2 className="font-display text-[15px] leading-tight tracking-tight text-fg-primary">
              {title}
            </h2>
            <p id={bodyId} className="mt-1 text-[13px] leading-snug text-fg-secondary">
              {body}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            aria-label={labels.previous}
            aria-disabled={step === 0}
            onClick={() => {
              if (step > 0) onPrevious();
            }}
            className="coach-quiet -ml-2.5 size-11 aria-disabled:opacity-30 md:size-8"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            aria-hidden
            className="ml-auto hidden font-mono text-[10px] text-fg-secondary md:inline"
          >
            ← →
          </span>
          <button
            ref={next}
            type="button"
            onClick={onNext}
            className={cn("coach-next ml-auto md:ml-2", last && "pr-3.5")}
          >
            {last ? labels.finish : labels.next}
            {last ? null : <ChevronRight className="-mr-1 size-3.5" />}
          </button>
        </div>
      </section>
    </>
  );

  return (
    <>
      <span ref={home} hidden />
      {root ? createPortal(layer, root) : null}
    </>
  );
}
