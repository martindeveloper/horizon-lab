"use client";

import { Ellipsis, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { IconButton, ListItem, Tooltip, cn } from "@horizon/toolkit/ui";

import { useDismissOnEscape } from "../shell/use-dismiss-on-escape";

export type MoreItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** A tool that is on (an open panel, a dropped overlay): its row is marked. */
  active?: boolean;
};

/**
 * Phones fold a scene toolbar's lesser tools into one button at its end: a short list of
 * named tools drops below it. Escape, an outside tap or tabbing away closes it; a choice
 * closes it and leaves focus on the button, so a dialog it opens returns there.
 */
export function SceneMoreMenu({
  items,
  className,
}: {
  items: readonly MoreItem[];
  className?: string;
}) {
  const label = useTranslations("shell")("moreTools");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => setOpen(false);
  useDismissOnEscape(open, button, close);

  useEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !el.contains(e.target)) setOpen(false);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && !el.contains(e.relatedTarget)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <Tooltip label={label} align="end">
        <IconButton
          ref={button}
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          active={open || items.some((item) => item.active)}
          onClick={() => setOpen(!open)}
        >
          <Ellipsis className="size-4 md:size-3.5" />
        </IconButton>
      </Tooltip>
      {open ? (
        <div
          id={id}
          role="group"
          aria-label={label}
          className="glass-popover absolute top-[calc(100%+0.75rem)] right-0 z-[70] w-56 max-w-[calc(100vw-2rem)] anim-fade rounded-lg p-1.5"
        >
          {items.map(({ id: key, label: name, icon: Icon, onSelect, active }) => (
            <ListItem
              key={key}
              aria-pressed={active}
              onClick={() => {
                setOpen(false);
                button.current?.focus({ preventScroll: true });
                onSelect();
              }}
              className="justify-start"
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-fg-secondary")} />
              {name}
            </ListItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}
