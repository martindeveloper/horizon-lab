"use client";

import { Fullscreen, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { IconButton } from "./icon-button";
import {
  IMMERSIVE_SHORTCUT,
  enterFullscreen,
  exitFullscreen,
  fullscreenAvailable,
  immersiveKeyAction,
  isImmersive,
  markFocusReturn,
  setImmersive,
  subscribeImmersive,
  takeFocusReturn,
} from "./immersive-state";
import { Toolbar } from "./toolbar";
import { Tooltip } from "./tooltip";

const never = () => () => {};

function subscribeFullscreen(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

/** Whether the page is in immersive view; always false on the server. */
export function useImmersive() {
  return useSyncExternalStore(subscribeImmersive, isImmersive, () => false);
}

function leave(controls: Element | null, stage: string) {
  const focused = document.activeElement;
  markFocusReturn(
    !focused ||
      focused === document.body ||
      (focused !== controls && !!controls?.contains(focused)),
  );
  setImmersive(false);
  const element = controls?.closest(stage);
  if (element) void exitFullscreen(element);
}

export type ImmersiveToggleProps = {
  /** Accessible name, e.g. "Enter immersive view". */
  label: string;
  /** Short visible tooltip; the shortcut is appended. */
  tooltip: string;
  /** The tooltip's anchor (`Tooltip`); `end` when the toggle ends the toolbar at the viewport's edge. */
  align?: "start" | "center" | "end";
};

/** Entry control for a HUD toolbar. It takes focus back when the view closes. */
export function ImmersiveToggle({ label, tooltip, align = "center" }: ImmersiveToggleProps) {
  const button = useRef<HTMLButtonElement>(null);
  const immersive = useImmersive();

  useEffect(() => {
    if (!immersive && takeFocusReturn()) button.current?.focus({ preventScroll: true });
  }, [immersive]);

  return (
    <Tooltip label={`${tooltip} · ${IMMERSIVE_SHORTCUT}`} align={align}>
      <IconButton
        ref={button}
        aria-label={label}
        aria-keyshortcuts={IMMERSIVE_SHORTCUT}
        onClick={() => setImmersive(true)}
      >
        <Maximize2 className="size-4 md:size-3.5" />
      </IconButton>
    </Tooltip>
  );
}

export type ImmersiveSceneProps = {
  /** Selector of the ancestor that covers the window and goes fullscreen. */
  stage: string;
  labels: { group: string; exit: string; exitTooltip: string; fullscreen: string };
  /** Close the scene's own tours or panels; called once per entry. */
  onEnter?: () => void;
  /** Overlays and controls, unmounted after fading out in immersive view. */
  children?: ReactNode;
};

/**
 * Mount once inside a scene, after its canvas. It marks the stage with
 * `data-immersive`, owns F / Escape, follows the browser out of fullscreen and
 * shows the exit control. The canvas is never touched, so WebGL stays alive.
 */
export function ImmersiveScene({ stage, labels, onEnter, children }: ImmersiveSceneProps) {
  const immersive = useImmersive();
  const [overlaysMounted, setOverlaysMounted] = useState(!immersive);
  const [previousImmersive, setPreviousImmersive] = useState(immersive);
  if (previousImmersive !== immersive) {
    setPreviousImmersive(immersive);
    if (!immersive) setOverlaysMounted(true);
  }
  useEffect(() => {
    if (!immersive) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 460;
    const timeout = window.setTimeout(() => setOverlaysMounted(false), delay);
    return () => window.clearTimeout(timeout);
  }, [immersive]);

  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(onEnter);
  const canFullscreen = useSyncExternalStore(
    never,
    () => fullscreenAvailable(document),
    () => false,
  );
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement?.matches(stage) === true,
    () => false,
  );

  useEffect(() => {
    entered.current = onEnter;
  });

  useEffect(() => {
    root.current?.closest(stage)?.toggleAttribute("data-immersive", immersive);
    if (!immersive) return;
    entered.current?.();
    // Keep shortcuts scoped to the scene without highlighting an action or opening its tooltip.
    root.current?.focus({ preventScroll: true });
  }, [immersive, stage]);

  useEffect(() => {
    const controls = root.current;
    const element = controls?.closest(stage) ?? null;
    let wasFullscreen = false;

    const onKey = (event: KeyboardEvent) => {
      const action = immersiveKeyAction(event, isImmersive());
      if (!action) return;
      // A single-letter shortcut acts only with focus in the stage (WCAG 2.1.4).
      if (action === "toggle" && !(event.target instanceof Node && element?.contains(event.target)))
        return;
      event.preventDefault();
      if (action === "exit" || isImmersive()) leave(controls, stage);
      else setImmersive(true);
    };
    // Esc or a browser control can end fullscreen; leave immersive view with it.
    const onFullscreen = () => {
      const now = element !== null && document.fullscreenElement === element;
      if (wasFullscreen && !now && isImmersive()) leave(controls, stage);
      wasFullscreen = now;
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      setImmersive(false);
      markFocusReturn(false);
      element?.removeAttribute("data-immersive");
      if (element) void exitFullscreen(element);
    };
  }, [stage]);

  async function requestFullscreen() {
    const element = root.current?.closest(stage);
    if (element && (await enterFullscreen(element))) root.current?.focus({ preventScroll: true });
  }

  return (
    <>
      {overlaysMounted ? (
        <div className="immersive-overlays" data-hidden={immersive} inert={immersive}>
          {children}
        </div>
      ) : null}
      <div
        ref={root}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 z-[80] outline-none"
      >
        <div
          className="immersive-controls pointer-events-none absolute top-0 right-0 z-[80]"
          data-hidden={!immersive}
          inert={!immersive}
        >
          <Toolbar
            aria-label={labels.group}
            className="opacity-70 transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100"
          >
            {canFullscreen && !fullscreen ? (
              <Tooltip label={labels.fullscreen}>
                <IconButton aria-label={labels.fullscreen} onClick={requestFullscreen}>
                  <Fullscreen className="size-4 md:size-3.5" />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip label={`${labels.exitTooltip} · Esc`}>
              <IconButton
                aria-label={labels.exit}
                aria-keyshortcuts={`Escape ${IMMERSIVE_SHORTCUT}`}
                onClick={() => leave(root.current, stage)}
              >
                <Minimize2 className="size-4 md:size-3.5" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </div>
      </div>
    </>
  );
}
