"use client";

import { Maximize, Minimize, X } from "lucide-react";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";

import { fillSize, resizedBy, type DialogSize } from "./dialog-size";
import { IconButton } from "./icon-button";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

/** `open(from)` grows it out of `from`, else out of the focused control, else the centre. */
export type DialogHandle = { open: (from?: Element | null) => void; close: () => void };

/** The grips a resizable dialog is dragged by: its edges and, inside its rounded corners, its corners. */
const GRIPS = [
  { ex: 0, ey: -1, className: "inset-x-7 top-0 h-2 cursor-ns-resize" },
  { ex: 0, ey: 1, className: "inset-x-7 bottom-0 h-2 cursor-ns-resize" },
  { ex: -1, ey: 0, className: "inset-y-7 left-0 w-2 cursor-ew-resize" },
  { ex: 1, ey: 0, className: "inset-y-7 right-0 w-2 cursor-ew-resize" },
  { ex: -1, ey: -1, className: "top-2 left-2 size-5 cursor-nwse-resize" },
  { ex: 1, ey: 1, className: "right-2 bottom-2 size-5 cursor-nwse-resize" },
  { ex: 1, ey: -1, className: "top-2 right-2 size-5 cursor-nesw-resize" },
  { ex: -1, ey: 1, className: "bottom-2 left-2 size-5 cursor-nesw-resize" },
] as const;

/** A size the visitor gave it: dragged, filling the screen, or easing back to its own. */
type Sized = DialogSize & { fill: boolean; restoring: boolean };
type Drag = { x: number; y: number; ex: -1 | 0 | 1; ey: -1 | 0 | 1; start: DialogSize };

/**
 * Browser-native focus containment, Escape dismissal and trigger-focus restoration; it grows
 * out of the control that opened it and shrinks back into it on closing. With `resize` its
 * edges and corners drag it larger or smaller about its centre, and two header buttons fill
 * the screen (less a margin) or return it to its own size, easing between them.
 */
export function Dialog({
  ref,
  title,
  closeLabel,
  size = "default",
  resize,
  children,
}: {
  ref?: Ref<DialogHandle>;
  title: string;
  closeLabel: string;
  /** `wide` gives a figure the room of a large screen. */
  size?: "default" | "wide";
  /** Makes it resizable, with these labels for the fill-screen and own-size buttons. */
  resize?: { fill: string; restore: string };
  children: ReactNode;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [sized, setSized] = useState<Sized | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Its own size, measured as the visitor first resizes it, to ease back to. */
  const own = useRef<DialogSize | null>(null);
  const drag = useRef<Drag | null>(null);

  /** Its size now made explicit, so a change eases from it rather than from its rules. */
  const hold = (element: HTMLDialogElement) => {
    if (sized) return;
    own.current = { width: element.offsetWidth, height: element.offsetHeight };
    Object.assign(element.style, {
      width: `${own.current.width}px`,
      height: `${own.current.height}px`,
      maxWidth: "none",
      maxHeight: "none",
    });
    void element.offsetWidth;
  };
  const fill = () => {
    const element = modal.current;
    if (!element) return;
    hold(element);
    setSized({ ...fillSize(window.innerWidth, window.innerHeight), fill: true, restoring: false });
  };
  const restore = () => {
    if (!sized || !own.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setSized(null);
    setSized({ ...own.current, fill: false, restoring: true });
  };
  const grip = (ex: -1 | 0 | 1, ey: -1 | 0 | 1) => ({
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      const element = modal.current;
      if (!element) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (!sized) own.current = { width: element.offsetWidth, height: element.offsetHeight };
      const start = { width: element.offsetWidth, height: element.offsetHeight };
      drag.current = { x: event.clientX, y: event.clientY, ex, ey, start };
      setDragging(true);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const { innerWidth, innerHeight } = window;
      const next = resizedBy(
        d.start,
        event.clientX - d.x,
        event.clientY - d.y,
        d.ex,
        d.ey,
        innerWidth,
        innerHeight,
      );
      setSized({ ...next, fill: false, restoring: false });
    },
    onPointerUp: () => {
      drag.current = null;
      setDragging(false);
    },
  });

  /* A filling dialog follows the screen; a dragged one stays on it. */
  useEffect(() => {
    if (!sized || sized.restoring) return;
    const follow = () =>
      setSized((s) => {
        if (!s) return s;
        const most = fillSize(window.innerWidth, window.innerHeight);
        return s.fill
          ? { ...most, fill: true, restoring: false }
          : { ...s, width: Math.min(s.width, most.width), height: Math.min(s.height, most.height) };
      });
    window.addEventListener("resize", follow);
    return () => window.removeEventListener("resize", follow);
  }, [sized]);
  useImperativeHandle(
    ref,
    () => ({
      open: (trigger) => {
        const element = modal.current;
        if (!element || element.open) return;
        /* It grows from what opened it and returns there (`ui-dialog`); offsets ignore the
           transition's starting scale. */
        const source =
          trigger ?? (document.activeElement === document.body ? null : document.activeElement);
        const from = source?.getBoundingClientRect();
        element.showModal();
        if (from)
          element.style.setProperty(
            "--dialog-origin",
            `${from.left + from.width / 2 - element.offsetLeft}px ${from.top + from.height / 2 - element.offsetTop}px`,
          );
      },
      close: () => modal.current?.close(),
    }),
    [],
  );
  useEffect(() => {
    const element = modal.current;
    if (!element) return;
    // Do not let modal keystrokes activate a simulation's window-level shortcuts.
    const isolateKeys = (event: KeyboardEvent) => event.stopPropagation();
    const dismissBackdrop = (event: MouseEvent) => {
      if (event.target !== element) return;
      const r = element.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        element.close();
    };
    element.addEventListener("keydown", isolateKeys);
    element.addEventListener("click", dismissBackdrop);
    return () => {
      element.removeEventListener("keydown", isolateKeys);
      element.removeEventListener("click", dismissBackdrop);
      element.close();
    };
  }, []);
  return (
    <dialog
      ref={modal}
      aria-labelledby={titleId}
      data-sized={sized ? "" : undefined}
      data-resizing={dragging ? "" : undefined}
      style={
        sized
          ? { width: sized.width, height: sized.height, maxWidth: "none", maxHeight: "none" }
          : undefined
      }
      onTransitionEnd={(event) => {
        /* Back at its own size, its own rules take over again. */
        if (
          sized?.restoring &&
          event.target === event.currentTarget &&
          (event.propertyName === "width" || event.propertyName === "height")
        )
          setSized(null);
      }}
      className={cn(
        "ui-dialog group/dialog m-auto max-h-[85dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-overlay border border-border bg-surface-primary p-0 pb-1.5 text-fg-primary shadow-overlay backdrop:bg-space/75 backdrop:backdrop-blur-sm open:flex",
        size === "wide" ? "max-w-5xl" : "max-w-2xl",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-section border-b border-border px-panel-roomy py-panel sm:px-panel-wide">
        <h2 id={titleId} className="font-display text-feature">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {resize ? (
            <>
              <Tooltip label={resize.restore} align="end">
                <IconButton
                  aria-label={resize.restore}
                  aria-disabled={!sized || sized.restoring}
                  onClick={restore}
                >
                  <Minimize className="icon" aria-hidden />
                </IconButton>
              </Tooltip>
              <Tooltip label={resize.fill} align="end">
                <IconButton aria-label={resize.fill} aria-disabled={!!sized?.fill} onClick={fill}>
                  <Maximize className="icon" aria-hidden />
                </IconButton>
              </Tooltip>
            </>
          ) : null}
          <IconButton autoFocus aria-label={closeLabel} onClick={() => modal.current?.close()}>
            <X className="icon" aria-hidden />
          </IconButton>
        </div>
      </header>
      {/* Only the body scrolls, so the bar starts under the header and stays
          inside the rounded frame (the bottom padding clears its corner). */}
      <div
        role="region"
        aria-labelledby={titleId}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll the body once focus leaves the close button.
        tabIndex={0}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain ui-focus focus-visible:ring-inset"
      >
        {children}
      </div>
      {resize
        ? GRIPS.map(({ ex, ey, className }) => {
            const handlers = grip(ex, ey);
            return (
              <div
                key={className}
                aria-hidden
                className={cn("absolute z-10 touch-none", className)}
                onDoubleClick={restore}
                onPointerCancel={handlers.onPointerUp}
                {...handlers}
              />
            );
          })
        : null}
    </dialog>
  );
}
