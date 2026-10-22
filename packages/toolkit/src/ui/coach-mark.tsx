"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { WIDE_LAYOUT_QUERY } from "../environment";
import { Action } from "./action";
import { placeCard, type CoachRect } from "./coach-model";
import { IconButton } from "./icon-button";
import { isSceneShortcut } from "./keyboard";
import { useMediaQuery } from "./media-query";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

/** A control the coach may point at carries `data-coach="<id>"`. */
export const COACH_TARGET = "data-coach";
/** The button that opens the coach: a press on it is not a press outside. */
export const COACH_OPENER = "data-coach-opener";

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
  labels: { previous: string; next: string; finish: string; close: string };
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Where focus goes when the coach closes with focus inside it. */
  returnFocus?: () => HTMLElement | null | undefined;
};

type Found = { element: HTMLElement; rect: CoachRect; radius: string };
/** A target as found for a step: a step never acts on the one before's. */
type FoundFor = Found & { step: number };

const visible = (rect: DOMRect) => rect.width > 0 && rect.height > 0;

/** The first of `ids` on screen in `root`, and its box relative to the root's. */
function findTarget(root: HTMLElement, ids: readonly string[]): Found | null {
  const origin = root.getBoundingClientRect();
  for (const id of ids) {
    for (const element of root.querySelectorAll<HTMLElement>(`[${COACH_TARGET}="${id}"]`)) {
      const box = element.getBoundingClientRect();
      if (!visible(box)) continue;
      return {
        element,
        rect: {
          left: box.left - origin.left,
          top: box.top - origin.top,
          width: box.width,
          height: box.height,
        },
        radius: getComputedStyle(element).borderRadius,
      };
    }
  }
  return null;
}

/** Whether `node` is in the target or in what it has open (a picker's list, a panel: `aria-controls`). */
function within(target: HTMLElement, node: Element) {
  if (target.contains(node)) return true;
  const owners = [target, ...target.querySelectorAll("[aria-controls]")];
  return owners.some((owner) =>
    (owner.getAttribute("aria-controls") ?? "")
      .split(" ")
      .some((id) => id !== "" && !!document.getElementById(id)?.contains(node)),
  );
}

const sameRect = (a: CoachRect | undefined, b: CoachRect | undefined) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/**
 * Follows the step's target while the coach is open, a frame at a time (panels slide in, docks
 * wrap): only a change re-renders. Nothing runs once the coach closes.
 */
function useTarget(root: HTMLElement | null, ids: readonly string[], step: number) {
  const [found, setFound] = useState<FoundFor | null>(null);
  const key = ids.join(" ");
  useEffect(() => {
    if (!root) return;
    let frame = 0;
    let last: Found | null = null;
    const look = () => {
      const next = key ? findTarget(root, key.split(" ")) : null;
      if (next?.element !== last?.element || !sameRect(next?.rect, last?.rect)) {
        last = next;
        setFound(next && { ...next, step });
      }
      frame = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(frame);
  }, [root, key, step]);
  return found?.step === step ? found : null;
}

/**
 * A guided tour's coach mark: no veil over the scene, only a gold ring that moves onto the
 * control the step is about and a small glass card beside it with the words, the steps and
 * Back, Next and close. Drawn in the `scope` ancestor (the stage); on the touch layout, and
 * with nothing to point at, the card rests at the top or the foot of the stage, away from the
 * target. Escape, the close button and a press outside the card, the target and what the
 * target has open close it; the arrow keys step. Next takes focus as it opens; each step is announced politely.
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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const wide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const bodyId = useId();
  const found = useTarget(root, targets, step);
  const last = step >= total - 1;

  useLayoutEffect(() => {
    setRoot(home.current?.parentElement?.closest<HTMLElement>(scope) ?? document.body);
  }, [scope]);

  /* The card's and the stage's sizes, for placing the card beside its target. */
  useEffect(() => {
    const el = card.current;
    if (!el || !root) return;
    const observer = new ResizeObserver(() => {
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
      setStageSize({ width: root.clientWidth, height: root.clientHeight });
    });
    observer.observe(el);
    observer.observe(root);
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

  /* Escape closes from anywhere, the arrows step from the scene or the card; a press outside the card, its target and the opener closes. */
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
      if (card.current?.contains(node) || node.closest(`[${COACH_OPENER}]`)) return;
      if (handlers.current.target && within(handlers.current.target, node)) return;
      handlers.current.onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  const rect = found?.rect;
  const radius = found?.radius ?? "0px";
  /* Beside the target on the desktop; else away from it, at the stage's top or foot. */
  const placed =
    rect && wide && cardSize.width > 0 ? placeCard(rect, cardSize, stageSize, GAP) : null;
  const atTop = !placed && !!rect && rect.top + rect.height / 2 > stageSize.height / 2;
  const cardStyle: CSSProperties = placed
    ? { left: placed.left, top: placed.top }
    : atTop
      ? { top: `calc(var(--app-header-height, 0px) + ${GAP}px)` }
      : { bottom: "var(--hud-clear, 6rem)" };

  const layer = (
    <>
      {rect ? (
        <div
          aria-hidden
          className="coach-ring pointer-events-none absolute z-[80]"
          style={{
            left: rect.left - RING_PAD,
            top: rect.top - RING_PAD,
            width: rect.width + 2 * RING_PAD,
            height: rect.height + 2 * RING_PAD,
            borderRadius: `calc(${radius} + ${RING_PAD}px)`,
          }}
        />
      ) : null}
      <section
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-describedby={bodyId}
        style={cardStyle}
        className={cn(
          "coach-card glass glass-edge pointer-events-auto absolute z-[81] flex flex-col rounded-xl px-4 pt-3 pb-2.5",
          placed
            ? "w-80"
            : "inset-x-(--hud-gutter,1rem) mx-auto max-w-sm md:inset-x-0 md:w-80 md:max-w-none",
        )}
      >
        <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase tabular-nums">
          {kicker}
        </p>
        <div className="mt-1" aria-live="polite" aria-atomic>
          <div key={step} className="anim-fade">
            <h2 className="font-display text-base leading-tight tracking-tight text-fg">{title}</h2>
            <p id={bodyId} className="mt-1 text-sm leading-snug text-muted">
              {body}
            </p>
          </div>
        </div>
        <div aria-hidden className="mt-3 flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                i === step ? "bg-solar" : i < step ? "bg-solar/50" : "bg-fg/15",
              )}
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <IconButton
            aria-label={labels.previous}
            aria-disabled={step === 0}
            className="aria-disabled:opacity-40"
            onClick={() => {
              if (step > 0) onPrevious();
            }}
          >
            <ChevronLeft className="size-4" />
          </IconButton>
          <Action ref={next} className="ml-auto px-4" onClick={onNext}>
            {last ? labels.finish : labels.next}
            {last ? null : <ChevronRight className="-mr-1 size-4" />}
          </Action>
          <Tooltip label={labels.close} align="end">
            <IconButton aria-label={labels.close} onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </Tooltip>
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
