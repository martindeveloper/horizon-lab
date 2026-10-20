import type { useTranslations } from "next-intl";

import { skyNow, skyRunsFast, subscribeDebug } from "@/lib/debug";
import {
  horizontalPositions,
  OBSERVER,
  siderealTime,
  starColor,
  type Horizontal,
} from "@/space/observer-sky";
import { FINE_POINTER_QUERY } from "@horizon/toolkit/environment";

import { nearestStar, type PlacedStar } from "./sky-picking";

export type PlacedHorizontal = Horizontal & { x: number; y: number };
type Translate = ReturnType<typeof useTranslations<"shell">>;
type MotionQuery = Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

/** The bright stars that breathe. */
export const TWINKLE_COUNT = 12;
/** Degrees of altitude from the horizon hairline to the top of the window. */
const DEGREES_SHOWN = 90;
/** How close (px) the pointer must come to a star to name it. */
const HOVER_RADIUS = 22;
/** Scrolling one pixel moves the sky four seconds on: a 1,000 px page spans about an hour. */
const LAPSE_MS_PER_PX = 4000;
/** Keep hover quiet over page content, except the hero copy floating over the sky. */
const CONTENT =
  "a, button, input, select, textarea, label, p:not(.intro-kicker), h1:not(.intro-title), h2, h3, h4, li, dt, dd, blockquote, figcaption, img, header, footer, nav, [role='dialog'], .glass, .glass-panel, .glass-pill, .glass-hud, .glass-popover, .simulation-tile";

/**
 * The stars up at the moment, on a w × h window looking south with the horizon along its
 * bottom edge and equal degrees per pixel; those within 8 px of the window's sides stay.
 */
export function placeStars(now: Date, w: number, h: number): PlacedHorizontal[] {
  const scale = h / DEGREES_SHOWN;
  return horizontalPositions(now, OBSERVER.latitude, OBSERVER.longitude)
    .filter((p) => p.altitude > 0)
    .map((p) => ({ ...p, x: w / 2 + (p.azimuth - 180) * scale, y: h - p.altitude * scale }))
    .filter((p) => p.x > -8 && p.x < w + 8 && p.y > -8);
}

/**
 * How a star is drawn: larger and brighter the lower its magnitude, fading into the haze
 * over the last 12° above the horizon, and the brightest in a soft glow. A light page dims
 * them all to grey.
 */
export function starDot(p: PlacedHorizontal, dim: boolean) {
  const mag = p.star[3];
  const radius = Math.max(0.5, 2.2 - mag * 0.42);
  const extinction = Math.min(1, p.altitude / 12);
  const alpha = Math.min(1, 1.1 - mag * 0.18) * extinction * (dim ? 0.3 : 1);
  const colour: readonly [number, number, number] = dim ? [40, 44, 52] : starColor(p.star[4]);
  const glow = !dim && mag < 1.2 ? 0.08 * extinction : null;
  return { radius, alpha, colour, glow };
}

/** The `count` brightest of the placed stars. */
export const brightest = <T extends { star: Horizontal["star"] }>(
  stars: readonly T[],
  count: number,
) => [...stars].sort((a, b) => a.star[3] - b.star[3]).slice(0, count);

/** A meteor every 9 to 24 seconds. */
export const meteorDelay = (random: () => number = Math.random) => 9000 + random() * 15000;

/** Where a meteor starts (vw, vh) and which way it falls (degrees). */
export const meteorPath = (random: () => number = Math.random) => ({
  x: 15 + random() * 70,
  y: 5 + random() * 40,
  angle: 190 + random() * 30,
});

/** Milliseconds the scroll has run the sky past the present, when a mouse and motion allow it. */
export const scrollLapse = (scrollY: number, allowed: boolean) =>
  allowed ? scrollY * LAPSE_MS_PER_PX : 0;

/** The layers ease a little after the pointer, and back to rest when it leaves. */
function createParallax(layers: HTMLElement[], onPaint: () => void) {
  let targetX = 0.5;
  let targetY = 0.5;
  let x = 0.5;
  let y = 0.5;
  let frame = 0;
  const paint = () => {
    for (const layer of layers) {
      const amount = Number(layer.dataset.parallax);
      layer.style.transform = `translate3d(${((0.5 - x) * amount).toFixed(2)}px, ${((0.5 - y) * amount).toFixed(2)}px, 0)`;
    }
    onPaint();
  };
  const step = () => {
    x += (targetX - x) * 0.05;
    y += (targetY - y) * 0.05;
    paint();
    frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.001 ? requestAnimationFrame(step) : 0;
  };
  const ease = () => {
    if (!frame) frame = requestAnimationFrame(step);
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  return {
    /** The layers' current shift per unit of depth, in px. */
    shift: () => ({ x: 0.5 - x, y: 0.5 - y }),
    aim(toX: number, toY: number) {
      targetX = toX;
      targetY = toY;
      ease();
    },
    rest() {
      targetX = 0.5;
      targetY = 0.5;
      ease();
    },
    /** Everything back in place at once, for reduced motion. */
    still() {
      stop();
      targetX = x = 0.5;
      targetY = y = 0.5;
      paint();
    },
    stop,
    clear() {
      for (const layer of layers) layer.style.transform = "";
    },
  };
}

/** A meteor crosses now and then while the page is in view and motion is allowed. */
function createMeteor(meteor: HTMLElement | null, motion: () => boolean) {
  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fire, meteorDelay());
  };
  const fire = () => {
    if (!motion()) return;
    if (meteor && !document.hidden) {
      meteor.removeAttribute("data-live");
      const path = meteorPath();
      meteor.style.setProperty("--mx", `${path.x.toFixed(1)}vw`);
      meteor.style.setProperty("--my", `${path.y.toFixed(1)}vh`);
      meteor.style.setProperty("--angle", `${path.angle.toFixed(1)}deg`);
      void meteor.offsetWidth;
      meteor.setAttribute("data-live", "");
    }
    schedule();
  };
  return {
    schedule,
    cancel: () => window.clearTimeout(timer),
    hide: () => meteor?.removeAttribute("data-live"),
  };
}

/**
 * Runs the sky inside `sky`: the brightest stars as they stand over Ondřejov Observatory
 * at this moment, looking south, with the page's horizon hairline as the horizon. Redrawn
 * each minute, so the slow drift is sidereal motion. A few bright stars breathe, a meteor
 * crosses now and then, and the field eases a little after the pointer. With a mouse, a
 * star near the pointer is ringed and named, and scrolling runs the sky forward (scrolling
 * back returns to now, so the top of every page is the present). Reduced motion, read live
 * from `reduce`, gets a still sky at the present. Returns the teardown.
 */
export function createSky(
  sky: HTMLElement,
  { t, locale, reduce }: { t: Translate; locale: string; reduce: MotionQuery },
) {
  const canvas = sky.querySelector<HTMLCanvasElement>("canvas");
  const twinkles = Array.from(sky.querySelectorAll<HTMLElement>("[data-twinkle]"));
  const layers = Array.from(sky.querySelectorAll<HTMLElement>("[data-parallax]"));
  const mark = sky.querySelector<HTMLElement>("[data-star-mark]");
  const label = sky.querySelector<HTMLElement>("[data-star-label]");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return () => {};
  const light = () => document.documentElement.classList.contains("light");
  const realDepth = Number(canvas.parentElement?.dataset.parallax ?? 0);
  const magnitude = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const nameOf = (name: string) => (t.has(`starNames.${name}`) ? t(`starNames.${name}`) : name);
  const motion = () => !reduce.matches;
  const pointer = window.matchMedia(FINE_POINTER_QUERY).matches;

  // Stars on screen, in the real layer's coordinates, for naming them under the pointer.
  let placed: PlacedHorizontal[] = [];
  // Milliseconds the scroll has moved the sky past the present.
  let lapse = 0;

  // Size the canvas only when the window changes; a time-lapse redraws every frame.
  let fitted = "";
  const fit = (w: number, h: number, dpr: number) => {
    const size = `${w}x${h}@${dpr}`;
    if (size === fitted) return;
    fitted = size;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };

  // Draw the sky for "now" plus any scroll lapse.
  const draw = () => {
    const now = new Date(skyNow() + lapse);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fit(w, h, dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, w, h);
    const dim = light();
    const visible = placeStars(now, w, h);
    for (const p of visible) {
      const { radius, alpha, colour, glow } = starDot(p, dim);
      const [r, g, b] = colour;
      context.beginPath();
      context.arc(p.x, p.y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      context.fill();
      if (glow !== null) {
        context.beginPath();
        context.arc(p.x, p.y, radius * 3, 0, Math.PI * 2);
        context.fillStyle = `rgba(${r},${g},${b},${glow.toFixed(3)})`;
        context.fill();
      }
    }
    placed = visible;
    const bright = brightest(visible, TWINKLE_COUNT);
    twinkles.forEach((el, i) => {
      const p = bright[i];
      el.style.display = p ? "" : "none";
      if (p) {
        el.style.left = `${p.x.toFixed(1)}px`;
        el.style.top = `${p.y.toFixed(1)}px`;
        el.dataset.star = p.star[0];
      }
    });
    sky.dataset.observer = `${OBSERVER.name} ${OBSERVER.latitude}N ${OBSERVER.longitude}E, looking south`;
    sky.dataset.siderealTime = `${(siderealTime(now, OBSERVER.longitude) / 15).toFixed(3)}h`;
    sky.dataset.visibleStars = String(visible.length);
    sky.dataset.skyTime = now.toISOString();
    hover();
  };

  const parallax = createParallax(layers, () => hover());
  const meteor = createMeteor(sky.querySelector<HTMLElement>("[data-meteor]"), motion);

  // The nearest star within reach of the pointer, unless content has the pointer.
  let at: { x: number; y: number; free: boolean } | null = null;
  let named = "";
  const isFree = (target: EventTarget | null) =>
    !(target instanceof Element && target.closest(CONTENT));
  function hover() {
    if (!mark || !label) return;
    let best: PlacedStar | undefined;
    if (at?.free) {
      const shift = parallax.shift();
      best = nearestStar(
        placed,
        at.x - shift.x * realDepth,
        at.y - shift.y * realDepth,
        HOVER_RADIUS,
      );
    }
    if (!best) {
      mark.removeAttribute("data-on");
      label.removeAttribute("data-on");
      named = "";
      return;
    }
    for (const el of [mark, label]) {
      el.style.left = `${best.x.toFixed(1)}px`;
      el.style.top = `${best.y.toFixed(1)}px`;
    }
    if (named !== best.star[0]) {
      named = best.star[0];
      label.textContent = "";
      const name = document.createElement("span");
      name.textContent = nameOf(named);
      const mag = document.createElement("span");
      mag.className = "sky-label-mag";
      mag.textContent = t("starMagnitude", { value: magnitude.format(best.star[3]) });
      label.append(name, mag);
    }
    label.dataset.side = best.x > window.innerWidth - 180 ? "left" : "right";
    mark.setAttribute("data-on", "");
    label.setAttribute("data-on", "");
  }

  // Scroll runs the sky forward from now; reading scrollY makes the top of the page the present.
  let lapseFrame = 0;
  const lapseTarget = () => scrollLapse(window.scrollY, pointer && motion());
  const onScroll = () => {
    if (lapseFrame) return;
    lapseFrame = requestAnimationFrame(() => {
      lapseFrame = 0;
      // The page moved under a still pointer: what it is over may have changed.
      if (at) at.free = isFree(document.elementFromPoint(at.x, at.y));
      const next = lapseTarget();
      if (next === lapse) return hover();
      lapse = next;
      draw();
    });
  };
  const onMove = (event: PointerEvent) => {
    at = { x: event.clientX, y: event.clientY, free: isFree(event.target) };
    if (!motion()) return hover();
    parallax.aim(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  };
  const onLeave = () => {
    at = null;
    hover();
    parallax.rest();
  };

  // Idle: the sky itself once a minute; 20 times a second while a debug time scale runs it fast.
  let clock = 0;
  const start = () => {
    lapse = lapseTarget();
    draw();
    window.clearInterval(clock);
    clock = window.setInterval(draw, skyRunsFast() ? 50 : 60000);
    if (motion()) meteor.schedule();
  };
  const stop = () => {
    window.clearInterval(clock);
    meteor.cancel();
    parallax.stop();
    if (lapseFrame) cancelAnimationFrame(lapseFrame);
    lapseFrame = 0;
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  const onMotionPreference = () => {
    lapse = lapseTarget();
    draw();
    if (motion()) {
      meteor.schedule();
      return;
    }
    meteor.cancel();
    parallax.still();
    meteor.hide();
  };
  const theme = new MutationObserver(draw);

  start();
  const unsubscribe = subscribeDebug(() => !document.hidden && start());
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", draw);
  document.addEventListener("visibilitychange", onVisibility);
  reduce.addEventListener("change", onMotionPreference);
  if (pointer) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  return () => {
    stop();
    unsubscribe();
    theme.disconnect();
    window.removeEventListener("resize", draw);
    document.removeEventListener("visibilitychange", onVisibility);
    reduce.removeEventListener("change", onMotionPreference);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("scroll", onScroll);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    parallax.clear();
    meteor.hide();
    mark?.removeAttribute("data-on");
    label?.removeAttribute("data-on");
  };
}
