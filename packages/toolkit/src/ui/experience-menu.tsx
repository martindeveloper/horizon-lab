"use client";

import { Maximize2, Orbit, Telescope } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { IconButton } from "./icon-button";
import { ImmersiveToggle, useImmersive } from "./immersive";
import { IMMERSIVE_SHORTCUT, setImmersive, takeFocusReturn } from "./immersive-state";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

export type ExperienceMenuProps = {
  labels: {
    /** The button, and the group it opens ("Viewing modes"). */
    menu: string;
    /** Enters immersive view; the shortcut is appended to its tooltip. */
    immersive: string;
    /** Starts the drift. */
    drift: string;
  };
  /** Starts the scene's drift; it enters immersive view as well. Without it the button enters immersive view itself. */
  onDrift?: () => void;
  /** The tooltips' anchor (`Tooltip`); `end` when the menu ends a toolbar at the viewport's edge. */
  align?: "start" | "center" | "end";
  className?: string;
};

const icon = "size-4 md:size-3.5";

/**
 * One toolbar button for a scene's experiences. With a drift it opens a short column of round
 * buttons below itself: immersive view, then the drift. Without one it enters immersive view
 * directly, so the button sits in the same place with the same icon on every scene. Escape, an
 * outside press and tabbing away close the column; it takes focus back when immersive view ends.
 */
export function ExperienceMenu({
  labels,
  onDrift,
  align = "center",
  className,
}: ExperienceMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const immersive = useImmersive();

  useEffect(() => {
    if (!immersive && takeFocusReturn()) trigger.current?.focus({ preventScroll: true });
  }, [immersive]);

  useEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !el.contains(e.target)) setOpen(false);
    };
    // Escape closes only the column and hands focus back to the button.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && !el.contains(e.relatedTarget)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    el.addEventListener("keydown", onKey);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  const enter = () => {
    setOpen(false);
    setImmersive(true);
  };
  const drift = () => {
    setOpen(false);
    setImmersive(true);
    onDrift?.();
  };

  /* Without a drift the button is the immersive toggle, in the same place with the same icon. */
  if (!onDrift)
    return (
      <ImmersiveToggle
        label={labels.immersive}
        tooltip={labels.immersive}
        align={align}
        icon={Telescope}
        {...(className !== undefined ? { className } : {})}
      />
    );

  return (
    <div ref={root} className={cn("relative", className)}>
      <Tooltip label={labels.menu} align={align}>
        <IconButton
          ref={trigger}
          aria-label={labels.menu}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          active={open}
          onClick={() => setOpen(!open)}
        >
          <Telescope
            className={cn(
              icon,
              "transition-transform duration-control ease-standard",
              open && "-rotate-12",
            )}
          />
        </IconButton>
      </Tooltip>
      {open ? (
        <div
          id={id}
          role="group"
          aria-label={labels.menu}
          className="experience-menu glass-hud absolute top-[calc(100%+0.5rem)] right-0 z-[70] flex flex-col items-center rounded-full p-0.5 not-md:gap-2"
        >
          <Tooltip label={`${labels.immersive} · ${IMMERSIVE_SHORTCUT}`} align={align}>
            <IconButton
              aria-label={labels.immersive}
              aria-keyshortcuts={IMMERSIVE_SHORTCUT}
              onClick={enter}
              className="experience-item"
            >
              <Maximize2 className={icon} />
            </IconButton>
          </Tooltip>
          <Tooltip label={labels.drift} align={align}>
            <IconButton aria-label={labels.drift} onClick={drift} className="experience-item">
              <Orbit className={icon} />
            </IconButton>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}
