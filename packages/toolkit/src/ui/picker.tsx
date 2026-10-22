"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";

import { kickerClass } from "./kicker";
import { cn } from "./utils";

export type PickerProps = {
  /** Current choice shown on the HUD pill. */
  label: ReactNode;
  /** Optional mono detail beside the label from the `lg` breakpoint. */
  detail?: ReactNode;
  /** Names the choice ("Views"); read before the current label and on the list. */
  "aria-label": string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
} & {
  /** Data attributes mark the pill itself (a tour's `data-coach`). */
  [data: `data-${string}`]: string | undefined;
};

/**
 * HUD pill that discloses a glass list of choices below it (disclosure
 * pattern: the rows are ordinary buttons in Tab order; mark the current one
 * with `ListItem selected`). Outside pointer and Escape close it; Escape and a
 * choice that closes it return focus to the pill.
 */
export function Picker({
  label,
  detail,
  "aria-label": ariaLabel,
  open,
  onOpenChange,
  children,
  className,
  triggerClassName,
  panelClassName,
  ...data
}: PickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const wasOpen = useRef(open);

  // A choice unmounts the focused row; hand focus back to the pill instead of the page.
  useLayoutEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      if (!active || active === document.body || root.current?.contains(active))
        trigger.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !el.contains(e.target)) onOpenChange(false);
    };
    // Escape closes only the picker and returns focus to its pill.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
      trigger.current?.focus({ preventScroll: true });
    };
    // Tabbing out of the list closes it.
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && !el.contains(e.relatedTarget)) onOpenChange(false);
    };
    window.addEventListener("pointerdown", onPointer);
    el.addEventListener("keydown", onKey);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={root} className={cn("pointer-events-auto relative min-w-0", className)}>
      <button
        {...data}
        ref={trigger}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "glass-hud flex h-11 max-w-[min(22rem,100%)] items-center gap-2 rounded-full px-3 focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden md:h-8",
          triggerClassName,
        )}
      >
        <span className="sr-only">{ariaLabel}: </span>
        <span className="truncate text-body/5 tracking-tight text-fg-primary">{label}</span>
        {detail ? <span className={cn("hidden lg:inline", kickerClass)}>{detail}</span> : null}
        <ChevronDown
          aria-hidden
          className={cn(
            "icon size-icon-compact text-fg-tertiary transition-transform duration-control ease-standard",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={ariaLabel}
          className={cn(
            "glass-popover absolute top-[calc(100%+0.5rem)] left-0 z-[70] max-h-[calc(100dvh-10rem)] w-[20rem] max-w-[calc(100vw-2rem)] anim-fade overflow-y-auto overscroll-contain rounded-panel p-3",
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
