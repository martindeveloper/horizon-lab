"use client";

import {
  Fullscreen,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { IconButton } from "./icon-button";
import {
  IMMERSIVE_SHORTCUT,
  driftKeyAction,
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
import { kickerClass } from "./kicker";
import { afterMotion } from "./motion";
import { Toolbar } from "./toolbar";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

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
  /** The button's icon; the expand arrows by default. */
  icon?: LucideIcon;
  className?: string;
};

/** Entry control for a HUD toolbar. It takes focus back when the view closes. */
export function ImmersiveToggle({
  label,
  tooltip,
  align = "center",
  icon: Icon = Maximize2,
  className,
}: ImmersiveToggleProps) {
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
        className={className}
      >
        <Icon className="icon-toolbar" />
      </IconButton>
    </Tooltip>
  );
}

/** A drift (the scene flying itself) that the immersive controls pause and stop. */
export type ImmersiveDrift = {
  /** The drift is on, playing or paused: the exit control stops it. */
  active: boolean;
  playing: boolean;
  /** Pauses or resumes it; Space does the same. */
  onToggle: () => void;
  labels: { pause: string; resume: string; stop: string };
  /** The music under the drift: on or off, and a control that silences or brings it back. */
  music?: { on: boolean; onToggle: () => void; labels: { mute: string; unmute: string } };
  /** A short readout under the controls while the drift is on (a clock rate); it fades with them. */
  caption?: ReactNode;
};

export type ImmersiveSceneProps = {
  /** Selector of the ancestor that covers the window and goes fullscreen. */
  stage: string;
  labels: { group: string; exit: string; exitTooltip: string; fullscreen: string };
  /** Close the scene's own tours or panels; called once per entry. */
  onEnter?: () => void;
  /** A drift under way: the controls pause it and the exit control stops it; they fade while it plays. */
  drift?: ImmersiveDrift;
  /** Overlays and controls, unmounted after fading out in immersive view. */
  children?: ReactNode;
};

/** Seconds of stillness before the controls fade while a drift plays. */
const IDLE_SECONDS = 3;

/** Whether the pointer and keys have been still for a while; false whenever `watch` is off. */
function useIdle(watch: boolean) {
  const [idle, setIdle] = useState(false);
  /* Each watch starts awake. */
  const [watched, setWatched] = useState(watch);
  if (watched !== watch) {
    setWatched(watch);
    setIdle(false);
  }
  useEffect(() => {
    if (!watch) return;
    let timer = 0;
    /* Any movement restarts the wait; the wait's end is what marks the stillness. */
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_SECONDS * 1000);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };
    arm();
    const events = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;
    for (const type of events) window.addEventListener(type, wake, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const type of events) window.removeEventListener(type, wake);
    };
  }, [watch]);
  return watch && idle;
}

/**
 * Mount once inside a scene, after its canvas. It marks the stage with
 * `data-immersive`, owns F / Escape, follows the browser out of fullscreen and
 * shows the exit control. The canvas is never touched, so WebGL stays alive.
 */
export function ImmersiveScene({ stage, labels, onEnter, drift, children }: ImmersiveSceneProps) {
  const immersive = useImmersive();
  const drifting = drift?.active === true;
  const idle = useIdle(immersive && drifting && drift.playing);
  const toggleDrift = useRef(drift?.onToggle);
  useEffect(() => {
    toggleDrift.current = drift?.onToggle;
  });
  const [overlaysMounted, setOverlaysMounted] = useState(!immersive);
  const overlays = useRef<HTMLDivElement>(null);
  const [previousImmersive, setPreviousImmersive] = useState(immersive);
  if (previousImmersive !== immersive) {
    setPreviousImmersive(immersive);
    if (!immersive) setOverlaysMounted(true);
  }
  useEffect(() => {
    if (!immersive || !overlays.current) return;
    return afterMotion(overlays.current, () => setOverlaysMounted(false));
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
      // Space pauses a drift, from the scene or an idle control; a control with focus keeps its own Space.
      if (
        isImmersive() &&
        driftKeyAction(event, controls?.dataset.drifting === "true") &&
        !(event.target instanceof Element && event.target.closest("button, a[href], [role=button]"))
      ) {
        event.preventDefault();
        toggleDrift.current?.();
        return;
      }
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
        <div
          ref={overlays}
          className="immersive-overlays"
          data-hidden={immersive}
          inert={immersive}
        >
          {children}
        </div>
      ) : null}
      <div
        ref={root}
        tabIndex={-1}
        data-drifting={drifting}
        className="pointer-events-none absolute inset-0 z-[80] outline-none"
      >
        <div
          className="immersive-controls pointer-events-none absolute top-0 right-0 z-[80]"
          data-hidden={!immersive}
          data-idle={idle}
          inert={!immersive}
        >
          <Toolbar
            aria-label={labels.group}
            className="ml-auto w-fit opacity-70 transition-opacity duration-control ease-standard focus-within:opacity-100 hover:opacity-100"
          >
            {canFullscreen && !fullscreen ? (
              <Tooltip label={labels.fullscreen}>
                <IconButton aria-label={labels.fullscreen} onClick={requestFullscreen}>
                  <Fullscreen className="icon-toolbar" />
                </IconButton>
              </Tooltip>
            ) : null}
            {drift && drifting ? (
              <Tooltip
                label={`${drift.playing ? drift.labels.pause : drift.labels.resume} · Space`}
              >
                <IconButton
                  aria-label={drift.playing ? drift.labels.pause : drift.labels.resume}
                  aria-pressed={!drift.playing}
                  aria-keyshortcuts="Space"
                  onClick={drift.onToggle}
                >
                  {drift.playing ? (
                    <Pause className="icon-toolbar" />
                  ) : (
                    <Play className="icon-toolbar" />
                  )}
                </IconButton>
              </Tooltip>
            ) : null}
            {drift && drifting && drift.music ? (
              <Tooltip label={drift.music.on ? drift.music.labels.mute : drift.music.labels.unmute}>
                <IconButton
                  aria-label={drift.music.on ? drift.music.labels.mute : drift.music.labels.unmute}
                  aria-pressed={!drift.music.on}
                  onClick={drift.music.onToggle}
                >
                  {drift.music.on ? (
                    <Volume2 className="icon-toolbar" />
                  ) : (
                    <VolumeX className="icon-toolbar" />
                  )}
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip label={`${drifting && drift ? drift.labels.stop : labels.exitTooltip} · Esc`}>
              <IconButton
                aria-label={drifting && drift ? drift.labels.stop : labels.exit}
                aria-keyshortcuts={`Escape ${IMMERSIVE_SHORTCUT}`}
                onClick={() => leave(root.current, stage)}
              >
                <Minimize2 className="icon-toolbar" />
              </IconButton>
            </Tooltip>
          </Toolbar>
          {drifting && drift?.caption !== undefined ? (
            <p className={cn(kickerClass, "mt-2 text-right text-fg-tertiary opacity-70")}>
              {drift.caption}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
