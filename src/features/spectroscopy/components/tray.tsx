"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { cn } from "@horizon/toolkit/ui";

type TrayPanel = {
  /** Also its `data-coach`, so the `?` tour can ring it. */
  id: string;
  /** The panel's name on its phone tab. */
  label: string;
  /** Its share of the desktop row, as `md:col-span-*` classes. */
  className?: string;
  children: ReactNode;
};

/**
 * The dock's controls as cards side by side on a desktop, across the stage's full width. On a
 * phone they become panels that slide sideways (swipe, or the tabs above them), so the dock
 * keeps one panel's height and leaves the spectrum its room; `action` (such as Check) stays in
 * the tab row, always in reach.
 */
export function Tray({ panels, action }: { panels: readonly TrayPanel[]; action?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /* A phone's strip is as tall as the panel in view, not the tallest one: written straight
     onto the strip whenever a panel resizes or another slides in. */
  const fit = () => {
    const el = scroller.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    const height = el.children[index]?.getBoundingClientRect().height;
    if (height) el.style.setProperty("--tray-height", `${height}px`);
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    for (const section of el.children) observer.observe(section);
    return () => observer.disconnect();
  });
  const go = (index: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  return (
    <div className="flex min-w-0 flex-col gap-2 md:gap-3">
      {panels.length > 1 || action ? (
        <div className="flex items-center gap-1 md:hidden">
          {panels.length > 1
            ? panels.map((panel, i) => (
                <button
                  key={panel.id}
                  type="button"
                  aria-pressed={i === active}
                  onClick={() => go(i)}
                  className={cn(
                    "relative h-9 rounded-full px-3.5 text-xs transition-colors duration-feedback ease-standard focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                    "after:absolute after:inset-x-0 after:-inset-y-1",
                    i === active ? "bg-fg-primary/10 font-medium text-fg-primary" : "text-fg-secondary",
                  )}
                >
                  {panel.label}
                </button>
              ))
            : null}
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
      ) : null}
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          fit();
        }}
        className="no-scrollbar -mx-3.5 flex h-(--tray-height,auto) snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain transition-[height] duration-control ease-enter motion-reduce:transition-none md:mx-0 md:grid md:h-auto md:grid-cols-12 md:items-stretch md:gap-3 md:overflow-visible"
      >
        {panels.map((panel) => (
          <section
            key={panel.id}
            data-coach={panel.id}
            aria-label={panel.label}
            className={cn(
              "flex w-full min-w-0 shrink-0 snap-start flex-col gap-2 px-3.5 py-1",
              "md:rounded-md md:bg-fg-primary/[0.03] md:p-3 md:ring-1 md:ring-border md:ring-inset",
              panel.className,
            )}
          >
            {panel.children}
          </section>
        ))}
      </div>
    </div>
  );
}

/** A panel's heading on a desktop card; on a phone its tab names it. */
export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="hidden h-5 items-center justify-between gap-3 text-xs text-fg-secondary md:flex">
      <span className="min-w-0 truncate">{children}</span>
      {aside}
    </div>
  );
}
