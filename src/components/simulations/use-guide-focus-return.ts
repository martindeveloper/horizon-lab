"use client";

import { useEffect, useRef } from "react";

/** Restore focus to the remounted entry button when its guide closes. */
export function useGuideFocusReturn(guideOpen: boolean) {
  const button = useRef<HTMLButtonElement>(null);
  const hadGuide = useRef(false);

  useEffect(() => {
    if (hadGuide.current && !guideOpen) button.current?.focus({ preventScroll: true });
    hadGuide.current = guideOpen;
  }, [guideOpen]);

  return button;
}
