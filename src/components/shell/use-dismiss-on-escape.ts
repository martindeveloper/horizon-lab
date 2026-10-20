import { useEffect, type RefObject } from "react";

/**
 * Escape closes an open menu and returns focus to the button that opened it. Listened for in
 * the capture phase, ahead of a scene's own Escape, which would otherwise close its panels too.
 */
export function useDismissOnEscape(
  open: boolean,
  trigger: RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
      trigger.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open, trigger, close]);
}
