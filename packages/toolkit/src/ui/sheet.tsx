"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ComponentProps } from "react";

import { cn } from "./utils";

export type SheetProps = ComponentProps<"div"> & {
  "aria-label": string;
  dismissLabel: string;
  onDismiss: () => void;
  panelClassName?: string;
};

/**
 * Bottom sheet over a scrim, with a grab handle. Fills its positioned parent;
 * the consumer limits it to small screens (e.g. `md:hidden`) and sets the
 * panel height. While it is displayed it is modal within that parent: focus
 * moves into it, sibling layers turn inert, Escape and the close button
 * dismiss it, and focus returns to where it was. When CSS hides it, it does
 * nothing, so a desktop rail can share the same state.
 */
export function Sheet({
  "aria-label": ariaLabel,
  dismissLabel,
  onDismiss,
  panelClassName,
  className,
  children,
  ...props
}: SheetProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let inerted: HTMLElement[] = [];
    let active = false;

    const engage = () => {
      const shown = el.getClientRects().length > 0;
      if (shown === active) return;
      active = shown;
      if (shown) {
        inerted = Array.from(el.parentElement?.children ?? []).filter(
          (node): node is HTMLElement => node !== el && node instanceof HTMLElement && !node.inert,
        );
        for (const node of inerted) node.inert = true;
        panel.current?.focus({ preventScroll: true });
      } else {
        for (const node of inerted) node.inert = false;
        inerted = [];
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      dismiss.current();
    };

    engage();
    const observer = new ResizeObserver(engage);
    observer.observe(el);
    el.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      el.removeEventListener("keydown", onKey);
      for (const node of inerted) node.inert = false;
      if (active && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div ref={root} className={cn("absolute inset-0 z-50", className)} {...props}>
      <div
        aria-hidden
        className="pointer-events-auto absolute inset-0 anim-fade bg-space/50"
        onClick={() => dismiss.current()}
      />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          "glass-panel pad-sheet pointer-events-auto absolute inset-x-0 bottom-0 flex anim-sheet flex-col overflow-hidden rounded-t-card outline-hidden",
          panelClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="relative flex shrink-0 justify-center">
          <div className="mt-2 h-1 w-10 rounded-full bg-fg-primary/25" aria-hidden />
          <button
            type="button"
            onClick={() => dismiss.current()}
            aria-label={dismissLabel}
            className="absolute top-1 right-0 flex size-9 items-center justify-center rounded-full text-fg-secondary opacity-0 transition-opacity duration-feedback ease-standard focus-visible:opacity-100 focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <X className="icon" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
