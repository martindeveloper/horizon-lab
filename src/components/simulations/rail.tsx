"use client";

import { useRef, type ReactNode } from "react";

import { PanelHeader, Sheet, kickerClass, useFocusHandoff } from "@horizon/toolkit/ui";

/** A titled group inside a rail. */
export function RailSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className={kickerClass}>{title}</h3>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Switch rows in a rail section; they bleed to the rail's edges so their hit areas line up. */
export function SwitchGroup({ children }: { children: ReactNode }) {
  return <div className="-mx-3 grid gap-0.5">{children}</div>;
}

/**
 * A panel beside the scene on wide screens, as tall as its content and never past the dock
 * (`--hud-clear`); a bottom
 * sheet on phones that leaves the scene visible above it, so a switch shows its effect.
 * `sheetLead` opens the phone sheet only, for tools the wide header carries elsewhere.
 */
export function Rail({
  id,
  title,
  closeLabel,
  onClose,
  sheetLead,
  children,
}: {
  id: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  sheetLead?: ReactNode;
  children: ReactNode;
}) {
  const rail = useRef<HTMLElement>(null);
  useFocusHandoff(rail);
  return (
    <>
      <aside
        ref={rail}
        id={id}
        tabIndex={-1}
        className="glass-panel anim-rail pointer-events-auto absolute top-14 right-(--hud-gutter) z-40 hidden max-h-[min(32rem,calc(100dvh-var(--app-header-height)-var(--app-footer-height)-6rem),calc(100%-3.5rem-var(--hud-clear,1rem)))] w-80 flex-col overflow-hidden rounded-lg outline-hidden md:flex"
        aria-label={title}
      >
        <PanelHeader
          title={title}
          onClose={onClose}
          closeLabel={closeLabel}
          className="items-center border-b border-border px-4 py-3"
        />
        <div className="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
      </aside>
      <Sheet
        className="md:hidden"
        panelClassName="max-h-[min(28rem,64dvh)]"
        aria-label={title}
        dismissLabel={closeLabel}
        onDismiss={onClose}
      >
        <PanelHeader
          title={title}
          onClose={onClose}
          closeLabel={closeLabel}
          className="items-center py-1.5"
        />
        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pt-2 pb-2">
          {sheetLead}
          {children}
        </div>
      </Sheet>
    </>
  );
}
