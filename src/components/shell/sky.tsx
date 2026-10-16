"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { usePathname } from "@/i18n/navigation";
import { skyNow, skyRunsFast, subscribeDebug } from "@/lib/debug";
import { simulationForPath } from "@/lib/simulations";
import { FINE_POINTER_QUERY, REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { mulberry32 } from "@horizon/toolkit/math";

import { horizontalPositions, OBSERVER, siderealTime, starColor, type Horizontal } from "./stars";

/* Seeded so server and client render the same filler. */

/* Faint filler for the thousands of stars below our catalogue's limit. */
const FILLER = (() => {
  const random = mulberry32(11);
  let dots = "";
  for (let i = 0; i < 220; i += 1) {
    dots += `<circle cx="${(random() * 1600).toFixed(1)}" cy="${(random() * 1000).toFixed(1)}" r="${(0.3 + random() * random() * 0.6).toFixed(2)}" opacity="${(0.2 + random() * 0.6).toFixed(2)}"/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><g fill="#fff">${dots}</g></svg>`,
  )}")`;
})();

const TWINKLE_COUNT = 12;
const DEGREES_SHOWN = 90;
/** How close (px) the pointer must come to a star to name it. */
const HOVER_RADIUS = 22;
/** Scrolling one pixel moves the sky four seconds on: a 1,000 px page spans about an hour. */
const LAPSE_MS_PER_PX = 4000;
/** Over these the page's own content has the pointer, so the sky stays quiet. */
const CONTENT =
  "a, button, input, select, textarea, label, p, h1, h2, h3, h4, li, dt, dd, blockquote, figcaption, img, header, footer, nav, [role='dialog'], .glass, .glass-panel, .glass-pill, .glass-hud, .glass-popover, .simulation-tile";

type Placed = Horizontal & { x: number; y: number };

/**
 * The shared sky, and it is the real one: the brightest stars as they stand
 * over Ondřejov Observatory at this moment, looking south, with the page's
 * horizon hairline as the horizon. Redrawn each minute, so the slow drift is
 * sidereal motion. A few bright stars breathe, a meteor crosses now and then,
 * and the field eases a little after the pointer. With a mouse, a star near the
 * pointer is ringed and named, and scrolling runs the sky forward (scrolling back
 * returns to now, so the top of every page is the present). Nothing runs over a
 * simulation, and reduced motion gets a still sky at the present.
 */
export function Sky() {
  const interactive = !simulationForPath(usePathname());
  const root = useRef<HTMLDivElement>(null);
  const t = useTranslations("shell");
  const locale = useLocale();

  useEffect(() => {
    const sky = root.current;
    if (!interactive || !sky) return;
    const canvas = sky.querySelector<HTMLCanvasElement>("canvas");
    const twinkles = Array.from(sky.querySelectorAll<HTMLElement>("[data-twinkle]"));
    const layers = Array.from(sky.querySelectorAll<HTMLElement>("[data-parallax]"));
    const meteor = sky.querySelector<HTMLElement>("[data-meteor]");
    const mark = sky.querySelector<HTMLElement>("[data-star-mark]");
    const label = sky.querySelector<HTMLElement>("[data-star-label]");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const light = () => document.documentElement.classList.contains("light");
    const realDepth = Number(canvas.parentElement?.dataset.parallax ?? 0);
    const magnitude = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const nameOf = (name: string) => (t.has(`starNames.${name}`) ? t(`starNames.${name}`) : name);

    // Stars on screen, in the real layer's coordinates, for naming them under the pointer.
    let placed: Placed[] = [];
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

    // Draw the sky for "now" plus any scroll lapse. Horizontal view toward south, equal degrees per pixel.
    const draw = () => {
      const now = new Date(skyNow() + lapse);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fit(w, h, dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);
      const scale = h / DEGREES_SHOWN;
      const dim = light();
      const visible = horizontalPositions(now, OBSERVER.latitude, OBSERVER.longitude)
        .filter((p) => p.altitude > 0)
        .map((p) => ({
          ...p,
          x: w / 2 + (p.azimuth - 180) * scale,
          y: h - p.altitude * scale,
        }))
        .filter((p) => p.x > -8 && p.x < w + 8 && p.y > -8);
      for (const p of visible) {
        const mag = p.star[3];
        const radius = Math.max(0.5, 2.2 - mag * 0.42);
        const extinction = Math.min(1, p.altitude / 12);
        const alpha = Math.min(1, 1.1 - mag * 0.18) * extinction * (dim ? 0.3 : 1);
        const [r, g, b] = dim ? [40, 44, 52] : starColor(p.star[4]);
        context.beginPath();
        context.arc(p.x, p.y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        context.fill();
        if (!dim && mag < 1.2) {
          context.beginPath();
          context.arc(p.x, p.y, radius * 3, 0, Math.PI * 2);
          context.fillStyle = `rgba(${r},${g},${b},${(0.08 * extinction).toFixed(3)})`;
          context.fill();
        }
      }
      placed = visible;
      const brightest = [...visible].sort((a, b) => a.star[3] - b.star[3]).slice(0, TWINKLE_COUNT);
      twinkles.forEach((el, i) => {
        const p = brightest[i];
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

    // Read live, so turning on reduced motion while the page is open stills the sky at once.
    const reduce = window.matchMedia(REDUCED_MOTION_QUERY);
    const motion = () => !reduce.matches;
    const pointer = window.matchMedia(FINE_POINTER_QUERY).matches;

    // Pointer parallax, eased.
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
      hover();
    };

    // The brightest star within reach of the pointer, ringed and named, unless content has the pointer.
    let at: { x: number; y: number; free: boolean } | null = null;
    let named = "";
    const isFree = (target: EventTarget | null) =>
      !(target instanceof Element && target.closest(CONTENT));
    function hover() {
      if (!mark || !label) return;
      let best: Placed | undefined;
      if (at?.free) {
        const px = at.x - (0.5 - x) * realDepth;
        const py = at.y - (0.5 - y) * realDepth;
        for (const p of placed) {
          if (Math.hypot(p.x - px, p.y - py) > HOVER_RADIUS) continue;
          if (!best || p.star[3] < best.star[3]) best = p;
        }
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
    const lapseTarget = () => (pointer && motion() ? window.scrollY * LAPSE_MS_PER_PX : 0);
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
    const step = () => {
      x += (targetX - x) * 0.05;
      y += (targetY - y) * 0.05;
      paint();
      frame =
        Math.abs(targetX - x) + Math.abs(targetY - y) > 0.001 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (event: PointerEvent) => {
      at = { x: event.clientX, y: event.clientY, free: isFree(event.target) };
      if (!motion()) return hover();
      targetX = event.clientX / window.innerWidth;
      targetY = event.clientY / window.innerHeight;
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onLeave = () => {
      at = null;
      hover();
      targetX = 0.5;
      targetY = 0.5;
      if (!frame) frame = requestAnimationFrame(step);
    };

    // Idle: a meteor every 9 to 24 seconds, and the sky itself once a minute.
    let meteorTimer = 0;
    let clock = 0;
    const scheduleMeteor = () => {
      window.clearTimeout(meteorTimer);
      meteorTimer = window.setTimeout(fireMeteor, 9000 + Math.random() * 15000);
    };
    const fireMeteor = () => {
      if (!motion()) return;
      if (meteor && !document.hidden) {
        meteor.removeAttribute("data-live");
        meteor.style.setProperty("--mx", `${(15 + Math.random() * 70).toFixed(1)}vw`);
        meteor.style.setProperty("--my", `${(5 + Math.random() * 40).toFixed(1)}vh`);
        meteor.style.setProperty("--angle", `${(190 + Math.random() * 30).toFixed(1)}deg`);
        void meteor.offsetWidth;
        meteor.setAttribute("data-live", "");
      }
      scheduleMeteor();
    };
    const start = () => {
      lapse = lapseTarget();
      draw();
      window.clearInterval(clock);
      // Once a minute; 20 times a second while a debug time scale runs the sky fast.
      clock = window.setInterval(draw, skyRunsFast() ? 50 : 60000);
      if (motion()) scheduleMeteor();
    };
    const stop = () => {
      window.clearInterval(clock);
      window.clearTimeout(meteorTimer);
      if (frame) cancelAnimationFrame(frame);
      if (lapseFrame) cancelAnimationFrame(lapseFrame);
      frame = 0;
      lapseFrame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotionPreference = () => {
      lapse = lapseTarget();
      draw();
      if (motion()) {
        scheduleMeteor();
        return;
      }
      window.clearTimeout(meteorTimer);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      targetX = x = 0.5;
      targetY = y = 0.5;
      paint();
      meteor?.removeAttribute("data-live");
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
      for (const layer of layers) layer.style.transform = "";
      meteor?.removeAttribute("data-live");
      mark?.removeAttribute("data-on");
      label?.removeAttribute("data-on");
    };
  }, [interactive, locale, t]);

  return (
    <div ref={root} className="horizon-sky" aria-hidden="true">
      <div className="sky-layer" data-parallax="10">
        <div className="sky-filler" style={{ maskImage: FILLER }} />
      </div>
      <div className="sky-layer" data-parallax="24">
        <canvas className="sky-real" />
        {Array.from({ length: TWINKLE_COUNT }, (_, i) => (
          <span
            key={i}
            data-twinkle
            className="sky-twinkle"
            style={{
              display: "none",
              "--period": `${5 + (i % 5) * 1.3}s`,
              "--delay": `${-(i * 1.7) % 9}s`,
            }}
          />
        ))}
        <span data-star-mark className="sky-mark" />
        <span data-star-label className="sky-label" />
      </div>
      <span data-meteor className="sky-meteor" />
    </div>
  );
}
