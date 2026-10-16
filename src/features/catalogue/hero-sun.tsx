"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { moonPosition, OBSERVER, sunPosition } from "@/components/shell/stars";
import { skyNow, skyRunsFast, subscribeDebug } from "@/lib/debug";

/** Highest noon Sun over Ondřejov (summer solstice), in degrees. */
const PEAK = 64;
/** Astronomical twilight: below this the horizon glow is gone. */
const TWILIGHT = 18;
const MINUTE = 60_000;
const DAY = 86_400_000;
/** Mean solar noon at Ondřejov, as milliseconds after 00:00 UTC. */
const NOON_UTC = (12 - OBSERVER.longitude / 15) * 3_600_000;
const STEP = 10 * MINUTE;
/** Redraw interval while a debug time scale runs the sky fast (20 per second). */
const FAST_TICK = 50;
/** Published sunrise and sunset: upper limb on the horizon, with refraction. */
const HORIZON = -0.833;
/** A hero mounted later than this after page load arrived by navigation: no intro. */
const INTRO_WINDOW = 4000;

/** Facing south: east on the left, west on the right. */
const toX = (azimuth: number) => Math.min(0.97, Math.max(0.03, (azimuth - 40) / 280));
const toRise = (altitude: number) => Math.max(-1, Math.min(1, altitude / PEAK));

type Body = { altitude: number; azimuth: number };

/**
 * A body's path sampled every ten minutes as flat [x, rise] pairs; NaN marks
 * samples below −12°, where the path is lifted. Pixels come later, so a
 * resize never recomputes the ephemeris.
 */
function sample(from: number, to: number, at: (ms: number) => Body) {
  const out: number[] = [];
  for (let ms = from; ms <= to; ms += STEP) {
    const p = at(ms);
    if (p.altitude < -12) out.push(Number.NaN, Number.NaN);
    else out.push(toX(p.azimuth), toRise(p.altitude));
  }
  return out;
}

function toPath(points: number[], w: number, h: number, size: number) {
  const lift = h - size;
  let d = "";
  let pen = false;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!;
    if (Number.isNaN(x)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${(x * w).toFixed(1)} ${(h - points[i + 1]! * lift).toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

/**
 * The lit part of a unit-radius-50 disc with its bright limb facing +x:
 * the right half, closed by the terminator, an ellipse whose half-width is
 * |1 − 2k| for an illuminated fraction k.
 */
function litPath(k: number) {
  const rx = (50 * Math.abs(1 - 2 * k)).toFixed(2);
  return `M0 -50A50 50 0 0 1 0 50A${rx} 50 0 0 ${k < 0.5 ? 0 : 1} 0 -50Z`;
}

/**
 * A panorama over Ondřejov facing south. Today's path of the Sun is drawn as
 * a faint gold arc, sunrise and sunset are marked where it meets the horizon
 * line, and the glass sun stands where the real Sun stands. The Moon follows
 * its own silver arc, lit to its real phase with the bright limb turned toward
 * the Sun. The server renders the scene empty. Bodies move on the minute while
 * the hero is visible; paths are recomputed every ten minutes and only
 * re-projected on resize.
 */
export function HeroScene({
  children,
  locale,
  sunLabel,
  moonLabel,
  skyLabel,
}: {
  children: ReactNode;
  locale: string;
  sunLabel: string;
  moonLabel: string;
  skyLabel: string;
}) {
  const sky = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGSVGElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const rise = useRef<HTMLSpanElement>(null);
  const set = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  // The intro plays on a fresh load; reached by navigation, the page is simply there.
  // So it is when the hero is mostly out of view: a reload restored mid-page, or
  // the reader scrolled on before it finished.
  // A tile still rising ignores the pointer, so no halo, tilt or shadow shows early.
  useLayoutEffect(() => {
    const hero = sky.current;
    const page = hero?.closest(".catalogue-intro");
    if (!hero || !page) return;
    const away = () => {
      const { bottom, height } = hero.getBoundingClientRect();
      return bottom < height / 2;
    };
    const skip = () => page.classList.remove("catalogue-intro");
    if (performance.now() > INTRO_WINDOW || away()) {
      skip();
      return;
    }
    // Browsers may restore the scroll position after hydration.
    const onScroll = () => {
      if (performance.now() > INTRO_WINDOW) window.removeEventListener("scroll", onScroll);
      else if (away()) {
        skip();
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    let live = true;
    for (const tile of page.querySelectorAll<HTMLElement>(".intro-tile")) {
      const rising = tile.getAnimations().filter((a) => a.playState !== "finished");
      if (!rising.length) continue;
      tile.dataset.entering = "";
      void Promise.allSettled(rising.map((a) => a.finished)).then(() => {
        if (live) delete tile.dataset.entering;
      });
    }
    return () => {
      live = false;
      window.removeEventListener("scroll", onScroll);
      for (const tile of page.querySelectorAll<HTMLElement>(".intro-tile"))
        delete tile.dataset.entering;
    };
  }, []);

  useEffect(() => {
    const el = sky.current;
    const svg = arc.current;
    const disc = sun.current;
    const luna = moon.current;
    if (!el || !svg || !disc || !luna) return;
    const [solarArc, lunarArc] = Array.from(svg.querySelectorAll("path"));
    const lit = luna.querySelector(".hero-moon-phase");
    const percent = new Intl.NumberFormat(locale, { style: "percent" });
    const signed = (value: number) => {
      const degrees = Math.round(value);
      return `${degrees < 0 ? "\u2212" : ""}${Math.abs(degrees)}°`;
    };
    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Prague",
    });
    const at = (ms: number) => sunPosition(new Date(ms), OBSERVER.latitude, OBSERVER.longitude);
    const lunar = (ms: number) => moonPosition(new Date(ms), OBSERVER.latitude, OBSERVER.longitude);

    // Ephemeris for the current ten-minute bucket: both paths, sunrise and sunset.
    let cache: {
      bucket: number;
      sun: number[];
      moon: number[];
      rise: { x: number; text: string } | null;
      set: { x: number; text: string } | null;
    } | null = null;

    const ephemeris = (now: number) => {
      const bucket = Math.floor(now / STEP);
      if (cache?.bucket === bucket) return false;
      // The solar day nearest to now, midnight to midnight.
      const noon = Math.round((now - NOON_UTC) / DAY) * DAY + NOON_UTC;
      let sunrise: number | null = null;
      let sunset: number | null = null;
      let previous = Number.NaN;
      const sun = sample(noon - DAY / 2, noon + DAY / 2, (ms) => {
        const p = at(ms);
        const above = p.altitude - HORIZON;
        if (!Number.isNaN(previous) && Math.sign(above) !== Math.sign(previous)) {
          const crossing = ms - (STEP * above) / (above - previous);
          if (above > 0) sunrise = crossing;
          else sunset = crossing;
        }
        previous = above;
        return p;
      });
      const event = (ms: number | null, text: (t: string) => string) =>
        ms === null ? null : { x: toX(at(ms).azimuth), text: text(time.format(ms)) };
      cache = {
        bucket,
        sun,
        // The Moon's path over the twelve hours either side of now.
        moon: sample(now - DAY / 2, now + DAY / 2, lunar),
        rise: event(sunrise, (t) => `↑ ${t}`),
        set: event(sunset, (t) => `${t} ↓`),
      };
      return true;
    };

    const mark = (label: HTMLSpanElement | null, event: { x: number; text: string } | null) => {
      if (!label) return;
      label.hidden = !event;
      if (!event) return;
      label.style.left = `${(event.x * 100).toFixed(2)}%`;
      label.textContent = event.text;
    };

    // Pixels: all layout reads first, then writes.
    const draw = () => {
      if (!cache) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const sunSize = disc.offsetWidth;
      const moonSize = luna.offsetWidth;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      solarArc?.setAttribute("d", toPath(cache.sun, w, h, sunSize));
      lunarArc?.setAttribute("d", toPath(cache.moon, w, h, moonSize));
      mark(rise.current, cache.rise);
      mark(set.current, cache.set);
    };

    const place = () => {
      const now = skyNow();
      const { altitude, azimuth } = at(now);
      const m = lunar(now);
      el.style.setProperty("--sun-x", toX(azimuth).toFixed(4));
      el.style.setProperty("--sun-rise", toRise(altitude).toFixed(4));
      el.style.setProperty(
        "--sun-glow",
        (altitude < 0
          ? Math.max(0, 1 + altitude / TWILIGHT)
          : Math.max(0.3, 1 - altitude / 40)
        ).toFixed(3),
      );
      el.style.setProperty("--moon-x", toX(m.azimuth).toFixed(4));
      el.style.setProperty("--moon-rise", toRise(m.altitude).toFixed(4));
      // The phase turns its bright limb to the Sun.
      const tilt = `rotate(${(m.limb - 90).toFixed(1)})`;
      // So do the rim and the glass highlight: the night limb has no lit edge.
      const toward = (m.limb * Math.PI) / 180;
      el.style.setProperty("--moon-limb", `${m.limb.toFixed(1)}deg`);
      el.style.setProperty("--moon-lx", Math.sin(toward).toFixed(3));
      el.style.setProperty("--moon-ly", (-Math.cos(toward)).toFixed(3));
      el.style.setProperty("--moon-light", m.illumination.toFixed(3));
      // Earthshine: the night side is brightest under a thin crescent, when Earth is nearly full.
      el.style.setProperty("--moon-earthshine", ((1 - m.illumination) ** 3).toFixed(3));
      lit?.setAttribute("d", litPath(m.illumination));
      // A touch larger than the disc, so the soft edge falls on the terminator, not the limb.
      lit?.setAttribute("transform", `${tilt} scale(1.06)`);
      el.dataset.sun = altitude > 0 ? "day" : altitude > -TWILIGHT ? "twilight" : "night";
      el.dataset.moon = m.altitude > 0 ? "up" : "down";
      el.dataset.ready = "";
      if (readout.current)
        readout.current.textContent = `${sunLabel} ${signed(altitude)} · ${moonLabel} ${signed(m.altitude)} · ${percent.format(m.illumination)}`;
      if (ephemeris(now)) draw();
    };

    // Tick on the minute (or fast under a debug time scale), only while the hero is on screen and the tab is visible.
    let timer = 0;
    let visible = true;
    const stop = () => window.clearTimeout(timer);
    const tick = () => {
      stop();
      if (!visible || document.hidden) return;
      place();
      timer = window.setTimeout(
        tick,
        skyRunsFast() ? FAST_TICK : MINUTE - (skyNow() % MINUTE) + 50,
      );
    };
    let pending = 0;
    const resize = new ResizeObserver(() => {
      if (!pending)
        pending = requestAnimationFrame(() => {
          pending = 0;
          draw();
        });
    });
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      tick();
    });
    const onVisibility = () => tick();

    tick();
    const unsubscribe = subscribeDebug(tick);
    resize.observe(el);
    sight.observe(el);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      unsubscribe();
      if (pending) cancelAnimationFrame(pending);
      resize.disconnect();
      sight.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [locale, sunLabel, moonLabel]);

  return (
    <>
      <div ref={sky} className="catalogue-sky hairline-solar">
        <svg ref={arc} className="hero-arc" aria-hidden preserveAspectRatio="none">
          <path className="hero-arc-sun" />
          <path className="hero-arc-moon" />
        </svg>
        <div className="hero-glow" aria-hidden />
        <div ref={sun} className="hero-sun" aria-hidden />
        {/* After the Sun: in an eclipse the Moon passes in front. */}
        <div ref={moon} className="hero-moon" aria-hidden>
          <svg viewBox="-50 -50 100 100">
            <defs>
              <clipPath id="hero-moon-disc">
                <circle r="50" />
              </clipPath>
              {/* A soft terminator. */}
              <filter id="hero-moon-terminator" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="1.6" />
              </filter>
              {/* Lit from above like the Sun's glass: brightest near the crown. */}
              <radialGradient
                id="hero-moon-glow"
                gradientUnits="userSpaceOnUse"
                cx="0"
                cy="-12"
                r="64"
              >
                <stop offset="0" className="hero-moon-core" />
                <stop offset="1" className="hero-moon-edge" />
              </radialGradient>
              <mask id="hero-moon-lit">
                <path className="hero-moon-phase" fill="#fff" filter="url(#hero-moon-terminator)" />
              </mask>
            </defs>
            <circle r="50" className="hero-moon-night" />
            <g clipPath="url(#hero-moon-disc)">
              <circle r="50" fill="url(#hero-moon-glow)" mask="url(#hero-moon-lit)" />
            </g>
          </svg>
        </div>
        <span ref={rise} className="hero-mark" hidden aria-hidden />
        <span ref={set} className="hero-mark" hidden aria-hidden />
        <div className="app-container relative z-10 flex h-full flex-col justify-end pb-10 lg:pb-14">
          {children}
        </div>
      </div>
      <div className="catalogue-ground">
        <p className="intro-ground app-container flex min-h-14 items-center justify-end gap-2 py-2 text-right font-mono text-xs leading-relaxed tracking-wide text-subtle lg:min-h-20">
          <span className="size-1 shrink-0 rounded-full bg-solar" aria-hidden />
          <span className="whitespace-nowrap">
            <span ref={readout} className="peer" />
            {/* Phones keep the figures on one line; the place reads on wider screens. */}
            <span className="peer-empty:hidden max-sm:hidden" aria-hidden>
              {" · "}
            </span>
            <span className="max-sm:sr-only">{skyLabel}</span>
          </span>
        </p>
      </div>
    </>
  );
}
