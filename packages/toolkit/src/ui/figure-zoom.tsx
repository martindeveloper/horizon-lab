"use client";

import { Expand, Minus, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { Dialog, type DialogHandle } from "./dialog";
import { IconButton } from "./icon-button";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";
import { ZOOM_MAX, ZOOM_REST, ZOOM_STEP, panBy, zoomAbout, type ZoomView } from "./zoom-pan";

export type FigureZoomLabels = {
  /** The enlarge button's name and tooltip. */
  open: string;
  close: string;
  zoomIn: string;
  zoomOut: string;
  /** The zoom readout, which puts the whole figure back. */
  reset: string;
  /** The dialog's fill-screen and own-size buttons. */
  fill: string;
  restore: string;
};

export type FigureZoomProps = {
  /** The dialog's title: what the figure shows. */
  title: string;
  labels: FigureZoomLabels;
  /** What heads the figure beside the enlarge button: a status, a caption. */
  label?: ReactNode;
  /** The figure; a function draws it for its place, `zoomed` in the dialog. */
  children: ReactNode | ((zoomed: boolean) => ReactNode);
  className?: string;
};

/** Wheel notches to scale: a notch (100 px) zooms about a fifth. */
const WHEEL_RATE = 0.002;
/** A press that moves less than this, px, in less than this, ms, is a tap; two close together zoom. */
const TAP_PX = 8;
const TAP_MS = 300;
/** The share of the frame an arrow key pans by. */
const KEY_PAN = 0.1;

/**
 * A figure (a chart, a diagram) headed by its label and an enlarge button that opens it in a
 * wide dialog over the screen, growing out of the button. There the figure can be zoomed in
 * further (wheel, pinch, double tap, the buttons or + / − / 0) and dragged about to study its
 * detail, and the dialog resized by its edges or filled to the screen; the figure takes all
 * the room it is given. The dialog draws the figure again, from its first opening on.
 */
export function FigureZoom({ title, labels, label, children, className }: FigureZoomProps) {
  const dialog = useRef<DialogHandle>(null);
  /* Each opening starts whole; the drawing stays while the dialog shrinks away. */
  const [opening, setOpening] = useState(0);
  const draw = (zoomed: boolean) => (typeof children === "function" ? children(zoomed) : children);
  return (
    <div className={className}>
      <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
        <div className="min-w-0">{label}</div>
        <Tooltip label={labels.open} align="end">
          <IconButton
            aria-label={labels.open}
            aria-haspopup="dialog"
            className="size-7 md:size-7"
            onClick={(event) => {
              setOpening(opening + 1);
              dialog.current?.open(event.currentTarget);
            }}
          >
            <Expand className="size-3.5" aria-hidden />
          </IconButton>
        </Tooltip>
      </div>
      {draw(false)}
      <Dialog
        ref={dialog}
        title={title}
        closeLabel={labels.close}
        size="wide"
        resize={{ fill: labels.fill, restore: labels.restore }}
      >
        {opening ? (
          <ZoomPan key={opening} title={title} labels={labels}>
            {draw(true)}
          </ZoomPan>
        ) : null}
      </Dialog>
    </div>
  );
}

/** A point of the frame in its own unscaled pixels, and the frame's size, while the dialog grows too. */
function framePoint(frame: HTMLElement, clientX: number, clientY: number) {
  const rect = frame.getBoundingClientRect();
  const width = frame.offsetWidth;
  const height = frame.offsetHeight;
  const k = rect.width > 0 ? width / rect.width : 1;
  return { x: (clientX - rect.left) * k, y: (clientY - rect.top) * k, width, height };
}

type Press = { x: number; y: number };
type Tap = { x: number; y: number; at: number };

/** The enlarged figure in a frame it can be zoomed and dragged within, with its zoom controls under it. */
function ZoomPan({
  title,
  labels,
  children,
}: {
  title: string;
  labels: FigureZoomLabels;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ZoomView>(ZOOM_REST);
  /* Buttons, keys and taps ease to their view; a hand's gesture is followed exactly. */
  const [eased, setEased] = useState(false);
  const presses = useRef(new Map<number, Press>());
  const travel = useRef(0);
  const pressedAt = useRef(0);
  const lastTap = useRef<Tap | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const p = framePoint(element, event.clientX, event.clientY);
      setEased(false);
      setView((v) =>
        zoomAbout(v, Math.exp(-event.deltaY * WHEEL_RATE), p.x, p.y, p.width, p.height),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  /** Zoomed by a step about the frame's centre (or a point), eased. */
  const step = (factor: number, at?: { x: number; y: number }) => {
    const element = frame.current;
    if (!element) return;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    setEased(true);
    setView((v) =>
      factor === 0
        ? ZOOM_REST
        : zoomAbout(v, factor, at?.x ?? width / 2, at?.y ?? height / 2, width, height),
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    presses.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (presses.current.size === 1) {
      travel.current = 0;
      pressedAt.current = event.timeStamp;
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const before = presses.current.get(event.pointerId);
    if (!before) return;
    const element = event.currentTarget;
    const others = [...presses.current.entries()].filter(([id]) => id !== event.pointerId);
    presses.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    travel.current += Math.hypot(event.clientX - before.x, event.clientY - before.y);
    const p = framePoint(element, event.clientX, event.clientY);
    const k = p.width / Math.max(1, element.getBoundingClientRect().width);
    setEased(false);
    if (others.length === 0) {
      setView((v) =>
        panBy(v, (event.clientX - before.x) * k, (event.clientY - before.y) * k, p.width, p.height),
      );
      return;
    }
    /* Two fingers: the gap between them scales, their midpoint carries the figure along. */
    const other = others[0]![1];
    const was = Math.hypot(before.x - other.x, before.y - other.y);
    const now = Math.hypot(event.clientX - other.x, event.clientY - other.y);
    const mid = framePoint(element, (event.clientX + other.x) / 2, (event.clientY + other.y) / 2);
    setView((v) =>
      panBy(
        zoomAbout(v, was > 0 ? now / was : 1, mid.x, mid.y, p.width, p.height),
        ((event.clientX - before.x) / 2) * k,
        ((event.clientY - before.y) / 2) * k,
        p.width,
        p.height,
      ),
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!presses.current.delete(event.pointerId) || presses.current.size > 0) return;
    if (travel.current > TAP_PX || event.timeStamp - pressedAt.current > TAP_MS) return;
    const p = framePoint(event.currentTarget, event.clientX, event.clientY);
    const tap = { x: p.x, y: p.y, at: event.timeStamp };
    const last = lastTap.current;
    if (
      last &&
      tap.at - last.at < TAP_MS &&
      Math.hypot(tap.x - last.x, tap.y - last.y) < 4 * TAP_PX
    ) {
      lastTap.current = null;
      step(view.scale >= ZOOM_MAX ? 0 : ZOOM_STEP, tap);
      return;
    }
    lastTap.current = tap;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const pan = (dx: number, dy: number) => {
      setEased(true);
      setView((v) =>
        panBy(
          v,
          dx * KEY_PAN * element.offsetWidth,
          dy * KEY_PAN * element.offsetHeight,
          element.offsetWidth,
          element.offsetHeight,
        ),
      );
    };
    const actions: Record<string, () => void> = {
      "+": () => step(ZOOM_STEP),
      "=": () => step(ZOOM_STEP),
      "-": () => step(1 / ZOOM_STEP),
      "0": () => step(0),
      ArrowLeft: () => pan(1, 0),
      ArrowRight: () => pan(-1, 0),
      ArrowUp: () => pan(0, 1),
      ArrowDown: () => pan(0, -1),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const zoomed = view.scale > 1;
  const percent = new Intl.NumberFormat(document.documentElement.lang || undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(view.scale);
  return (
    <div className="flex h-full flex-col px-panel-roomy py-panel sm:px-panel-wide">
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- A pan-and-zoom surface: drags, pinches, taps and its keys, with the buttons below for the same. */}
      <div
        ref={frame}
        role="group"
        aria-label={title}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users zoom and pan the figure with + / − / 0 and the arrows.
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "relative min-h-0 flex-1 touch-none overflow-hidden rounded-control ui-focus select-none",
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
      >
        <div
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
          }}
          className={cn(
            "[&_canvas]:max-h-[70dvh] [&_canvas]:object-contain [&_svg]:max-h-[70dvh]",
            /* A dialog the visitor sized gives the figure all its room, drawn whole within it. */
            "group-data-sized/dialog:size-full group-data-sized/dialog:[&_canvas]:size-full group-data-sized/dialog:[&_canvas]:max-h-none group-data-sized/dialog:[&_svg]:size-full group-data-sized/dialog:[&_svg]:max-h-none",
            zoomed && "[&_canvas]:[image-rendering:pixelated]",
            eased && "transition-transform duration-control ease-standard",
          )}
        >
          {children}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1">
        <IconButton
          aria-label={labels.zoomOut}
          aria-disabled={!zoomed}
          onClick={() => step(1 / ZOOM_STEP)}
        >
          <Minus className="icon" aria-hidden />
        </IconButton>
        <button
          type="button"
          aria-label={labels.reset}
          aria-disabled={!zoomed}
          onClick={() => zoomed && step(0)}
          className="min-w-14 rounded-control px-2 py-1 font-mono text-ui text-fg-secondary ui-quiet tabular-nums ui-focus"
        >
          {percent}
        </button>
        <IconButton
          aria-label={labels.zoomIn}
          aria-disabled={view.scale >= ZOOM_MAX}
          onClick={() => step(ZOOM_STEP)}
        >
          <Plus className="icon" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}
