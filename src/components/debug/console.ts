import { DEPLOYMENT_ID, ENVIRONMENT } from "@/config";
import {
  setFreeCamera,
  setRide,
  setSkyTime,
  setSkyTimeScale,
  setWebGLOverride,
  showDesktopNotice,
  showUpdateNotice,
  skyNow,
  skyTimeScale,
  triggerCrash,
  webglOverride,
} from "@/lib/debug";
import {
  COARSE_POINTER_QUERY,
  PHONE_QUERY,
  REDUCED_MOTION_QUERY,
  WIDE_LAYOUT_QUERY,
} from "@horizon/toolkit/environment";
import { probeWebGL, type WebGLSupport } from "@horizon/toolkit/rendering";

import { noticeDismissed } from "../shell/desktop-notice-state";

type LoseContext = { loseContext(): void; restoreContext(): void };

function isLoseContext(value: unknown): value is LoseContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "loseContext" in value &&
    "restoreContext" in value &&
    typeof value.loseContext === "function" &&
    typeof value.restoreContext === "function"
  );
}

/** One way to call a command: its arguments as typed in the console, and what it does. */
type Usage = readonly [args: string, help: string];

/**
 * A command carries its own help, so `help()` lists it by name with no table to keep in step.
 * Arguments are written out rather than read from the function: production minifies their names.
 */
function command<F extends (...args: never[]) => unknown>(
  run: F,
  ...usage: [Usage, ...Usage[]]
): F & { readonly usage: readonly Usage[] } {
  return Object.assign(run, { usage });
}

// The simulation canvas already owns a context, so getContext returns it rather than creating one.
function simulationContext() {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "[data-black-hole-canvas], [data-scene-canvas]",
  );
  return canvas?.getContext("webgl2") ?? null;
}

function gpuDetails() {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return { renderer: null, vendor: null, maxTexture: null };
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const details = {
    renderer: String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    vendor: String(gl.getParameter(info ? info.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
  };
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return details;
}

const media = (query: string) => window.matchMedia(query).matches;

export function createDebug() {
  const debug = {
    help: command(() => {
      const table: Record<string, string> = {};
      for (const [name, { usage }] of Object.entries(debug))
        for (const [args, help] of usage) table[`${name}(${args})`] = help;
      console.table(table);
    }, ["", "List these commands"]),
    info: command(() => {
      const snapshot = {
        environment: ENVIRONMENT,
        deployment: DEPLOYMENT_ID || "none (update notice off)",
        webgl: probeWebGL(),
        webglOverride: webglOverride(),
        ...gpuDetails(),
        layout: media(WIDE_LAYOUT_QUERY) ? "desktop" : "touch",
        viewport: `${innerWidth}×${innerHeight}`,
        devicePixelRatio,
        coarsePointer: media(COARSE_POINTER_QUERY),
        reducedMotion: media(REDUCED_MOTION_QUERY),
        locale: document.documentElement.lang,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        simulationContext: simulationContext() ? "live" : "none",
        desktopNotice: noticeDismissed() ? "dismissed" : media(PHONE_QUERY) ? "due" : "not a phone",
        skyTime: new Date(skyNow()).toString(),
        timeScale: skyTimeScale(),
      };
      console.table(snapshot);
      return snapshot;
    }, ["", "Device, GPU and layout snapshot"]),
    crash: command(() => {
      if (!triggerCrash("route"))
        console.warn("Horizon.Debug: this page has no route crash trigger");
    }, ["", "Throw inside the page → route error page (500)"]),
    crashRoot: command(() => {
      triggerCrash("root");
    }, ["", "Throw inside the shell → global error page"]),
    notFound: command(() => {
      window.location.assign("/horizon-debug-not-found");
    }, ["", "Open a missing page → 404"]),
    webgl: command(
      (mode?: WebGLSupport) => {
        if (mode !== undefined && !["ready", "software", "unavailable"].includes(mode))
          throw new TypeError('Use "unavailable", "software", "ready" or nothing');
        setWebGLOverride(mode ?? null);
        return mode ?? "auto";
      },
      [
        '"unavailable" | "software" | "ready"',
        "Force the WebGL check for this tab (persists across reloads)",
      ],
      ["", "Back to the real WebGL check"],
    ),
    loseContext: command(
      (ms = 1000) => {
        const extension: unknown = simulationContext()?.getExtension("WEBGL_lose_context");
        if (!isLoseContext(extension))
          return console.warn("Horizon.Debug: open a simulation first");
        const lose = extension;
        lose.loseContext();
        if (Number.isFinite(ms)) setTimeout(() => lose.restoreContext(), Math.max(0, ms));
      },
      ["ms = 1000", "Lose the simulation's GPU context; restore after ms, or never with Infinity"],
    ),
    desktopNotice: command(() => {
      if (!showDesktopNotice()) console.warn("Horizon.Debug: the notice is not mounted");
    }, ["", "Show the phone “best on a larger screen” notice now, on any device"]),
    updateNotice: command(() => {
      if (!showUpdateNotice()) console.warn("Horizon.Debug: the update notice is not mounted");
    }, ["", "Show the “new version available” notice now, without a new deployment"]),
    time: command(
      (when?: string | number | Date) => {
        if (when === undefined) {
          setSkyTime(null);
          return new Date(skyNow()).toString();
        }
        const ms = new Date(when).getTime();
        if (!Number.isFinite(ms))
          throw new TypeError('Use a date such as "2026-12-21 16:00", milliseconds, or a Date');
        setSkyTime(ms);
        return new Date(skyNow()).toString();
      },
      [
        '"2026-12-21 16:00" | ms | Date',
        "Set the hero and star sky to this moment (local time); keeps the time scale",
      ],
      ["", "Back to the real time"],
    ),
    timeScale: command(
      (scale = 1) => {
        if (!Number.isFinite(scale)) throw new TypeError("Use a finite number, e.g. 600");
        setSkyTimeScale(scale);
        return scale;
      },
      ["600", "Run the sky 600× faster (10 minutes a second); 0 freezes, 1 is real speed"],
    ),
    freeCamera: command(
      (on = true) => {
        if (!setFreeCamera(on)) console.warn("Horizon.Debug: this page has no free camera");
        else if (on)
          console.info(
            "Horizon.Debug: click the scene, then W/S/A/D, R/F, Q/E, Shift, wheel, Space",
          );
        return on;
      },
      [
        "",
        "Fly the simulation's camera freely: drag to look, W/S/A/D move, R/F up and down, Q/E roll, Shift faster, wheel sets the speed, Space stops",
      ],
      ["false", "Back to the simulation's own camera"],
    ),
    ride: command(
      (fraction?: number) => {
        if (fraction !== undefined && !Number.isFinite(fraction))
          throw new TypeError("Use a fraction from 0 (hover) to 1 (ride with the flow)");
        if (!setRide(fraction ?? null)) console.warn("Horizon.Debug: this page has no ride");
        return fraction ?? "auto";
      },
      [
        "1",
        "Move the camera with the scene's flow (the black hole's disk gas): the sky aberrates and shifts with its motion; 0 hovers",
      ],
      ["", "Back to the simulation's own ride"],
    ),
    reset: command(() => {
      setFreeCamera(false);
      setRide(null);
      setWebGLOverride(null);
      setSkyTimeScale(1);
      setSkyTime(null);
    }, ["", "Clear every override"]),
  };
  return debug;
}

export type HorizonDebug = ReturnType<typeof createDebug>;
