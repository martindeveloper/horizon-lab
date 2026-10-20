import {
  setSkyTime,
  setSkyTimeScale,
  setWebGLOverride,
  showDesktopNotice,
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

const COMMANDS = {
  "help()": "List these commands",
  "info()": "Device, GPU and layout snapshot",
  "crash()": "Throw inside the page → route error page (500)",
  "crashRoot()": "Throw inside the shell → global error page",
  "notFound()": "Open a missing page → 404",
  'webgl("unavailable" | "software" | "ready")':
    "Force the WebGL check for this tab (persists across reloads)",
  "webgl()": "Back to the real WebGL check",
  "loseContext(ms = 1000)":
    "Lose the simulation's GPU context; restore after ms, or never with Infinity",
  "desktopNotice()": "Show the phone “best on a larger screen” notice now, on any device",
  'time("2026-12-21 16:00" | ms | Date)':
    "Set the hero and star sky to this moment (local time); keeps the time scale",
  "time()": "Back to the real time",
  "timeScale(600)": "Run the sky 600× faster (10 minutes a second); 0 freezes, 1 is real speed",
  "reset()": "Clear every override",
} as const;

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
  return {
    help() {
      console.table(COMMANDS);
    },
    info() {
      const snapshot = {
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
    },
    crash() {
      if (!triggerCrash("route"))
        console.warn("Horizon.Debug: this page has no route crash trigger");
    },
    crashRoot() {
      triggerCrash("root");
    },
    notFound() {
      window.location.assign("/horizon-debug-not-found");
    },
    webgl(mode?: WebGLSupport) {
      if (mode !== undefined && !["ready", "software", "unavailable"].includes(mode))
        throw new TypeError('Use "unavailable", "software", "ready" or nothing');
      setWebGLOverride(mode ?? null);
      return mode ?? "auto";
    },
    loseContext(ms = 1000) {
      const extension: unknown = simulationContext()?.getExtension("WEBGL_lose_context");
      if (!isLoseContext(extension)) return console.warn("Horizon.Debug: open a simulation first");
      const lose = extension;
      lose.loseContext();
      if (Number.isFinite(ms)) setTimeout(() => lose.restoreContext(), Math.max(0, ms));
    },
    desktopNotice() {
      if (!showDesktopNotice()) console.warn("Horizon.Debug: the notice is not mounted");
    },
    time(when?: string | number | Date) {
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
    timeScale(scale = 1) {
      if (!Number.isFinite(scale)) throw new TypeError("Use a finite number, e.g. 600");
      setSkyTimeScale(scale);
      return scale;
    },
    reset() {
      setWebGLOverride(null);
      setSkyTimeScale(1);
      setSkyTime(null);
    },
  };
}

export type HorizonDebug = ReturnType<typeof createDebug>;
