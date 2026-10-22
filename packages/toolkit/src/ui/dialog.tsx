"use client";

import { X } from "lucide-react";
import { useEffect, useId, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";

import { IconButton } from "./icon-button";

export type DialogHandle = { open: () => void; close: () => void };

/** Browser-native focus containment, Escape dismissal and trigger-focus restoration. */
export function Dialog({
  ref,
  title,
  closeLabel,
  children,
}: {
  ref?: Ref<DialogHandle>;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        if (!modal.current?.open) modal.current?.showModal();
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
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-primary p-0 pb-1.5 text-fg-primary shadow-2xl backdrop:bg-space/75 backdrop:backdrop-blur-sm open:flex"
    >
      <header className="flex shrink-0 items-center justify-between gap-section border-b border-border px-panel-roomy py-panel sm:px-panel-wide">
        <h2 id={titleId} className="font-display text-feature">
          {title}
        </h2>
        <IconButton autoFocus aria-label={closeLabel} onClick={() => modal.current?.close()}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </header>
      {/* Only the body scrolls, so the bar starts under the header and stays
          inside the rounded frame (the bottom padding clears its corner). */}
      <div
        role="region"
        aria-labelledby={titleId}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll the body once focus leaves the close button.
        tabIndex={0}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
      >
        {children}
      </div>
    </dialog>
  );
}
