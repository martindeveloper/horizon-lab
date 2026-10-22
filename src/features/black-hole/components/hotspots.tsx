import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  GAUGE_TICKS,
  PIN_IDS,
  PIN_RING_COLOR,
  formatR,
  gaugeFraction,
  pinRadius,
  spreadLabels,
  type PinId,
} from "@/features/black-hole/lib/pins";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { cn, isSceneShortcut, useFocusHandoff } from "@horizon/toolkit/ui";

import { clearOverlay, drawOverHole, overlayFit, overlayLoop } from "./overlay-canvas";
import { PinLesson } from "./pin-lessons";
import { drawRing, ringTarget } from "./pin-rings";
import { useSceneCamera, useSceneFrames } from "./scene-camera";
import { SETTINGS_PANEL_ID } from "./settings";

/** Minimum label spacing on the gauge: one 44px touch target. */
const LABEL_GAP = 44;
/** Horizontal offset of the rail inside the gauge. */
const RAIL_X = 4.5;
/** From this layer width (the md breakpoint) the lesson card sits beside the gauge, joined by the leader. */
const DESKTOP_WIDTH = 768;
/** The lit ring fades and resizes with this time constant, in seconds… */
const RING_EASE = 0.22;
/** …until within this share of its target, where it settles; below this opacity it is not drawn. */
const RING_SETTLED = 0.002;
const RING_HIDDEN = 0.02;

export function Hotspots() {
  const cam = useSceneCamera();
  const frames = useSceneFrames();
  const t = useTranslations("blackHole");
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const railHRef = useRef(0);
  const youRef = useRef<HTMLSpanElement>(null);
  const youValueRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<Partial<Record<PinId, HTMLButtonElement | null>>>({});
  const cardRef = useRef<HTMLElement>(null);
  const active = useBlackHole((s) => s.activePin);
  const setActivePin = useBlackHole((s) => s.setActivePin);
  const spin = useBlackHole((s) => s.spin);
  const guideOpen = useBlackHole((s) => s.guideOpen);
  const clocksOpen = useBlackHole((s) => s.clocksOpen);
  const mapOpen = useBlackHole((s) => s.mapOpen);
  const [hover, setHover] = useState<PinId | null>(null);
  const [railH, setRailH] = useState(0);
  const focus = hover ?? active;
  const focusRef = useRef<PinId | null>(focus);
  const wakeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    focusRef.current = focus;
    wakeRef.current?.();
  }, [focus]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => {
      railHRef.current = rail.clientHeight;
      setRailH(rail.clientHeight);
      wakeRef.current?.();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [guideOpen, clocksOpen, mapOpen]);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!layer || !canvas || !ctx) return;
    let ringA = 0;
    let ringR = 0;
    let ringId: PinId | null = null;
    let ringDrawn = false;
    let youY = -1;
    let youText = "";

    const clearRing = () => {
      if (!ringDrawn) return;
      clearOverlay(ctx);
      ringDrawn = false;
    };

    /* Each frame reads every box it places against before it writes a style, so the browser
       lays the page out at most once; true while the ring is still easing. */
    const frame = (dt: number) => {
      const state = useBlackHole.getState();
      const fit = boxes.fit();
      if (!fit) return false;
      if (fit.resized) ringDrawn = true;
      const { layerBox, holeBox } = fit;
      const { width, height } = holeBox;

      const lit = focusRef.current;
      if (lit) ringId = lit;
      const openId = state.activePin;
      const desktop = layerBox.width >= DESKTOP_WIDTH;
      const card = cardRef.current;
      const openLabel = openId && desktop ? labelRefs.current[openId] : null;
      const leaderLabel = ringId && (desktop || !openId) ? labelRefs.current[ringId] : null;

      /* Reads. */
      const openBox = card && openLabel ? openLabel.getBoundingClientRect() : null;
      const gaugeRight = openBox ? railRef.current?.getBoundingClientRect().right : undefined;
      const cardSize = openBox && card ? [card.offsetWidth, card.offsetHeight] : null;
      const settingsRail =
        openBox && state.settingsOpen
          ? document.getElementById(SETTINGS_PANEL_ID)?.getBoundingClientRect()
          : undefined;
      const leaderBox = leaderLabel?.getBoundingClientRect() ?? null;

      /* Writes. */
      const you = youRef.current;
      const railHeight = railHRef.current;
      if (you && railHeight > 0) {
        const y = (1 - gaugeFraction(cam.dist)) * railHeight;
        if (Math.abs(y - youY) > 0.2) {
          youY = y;
          you.style.top = `${y}px`;
        }
        const text = `${formatR(cam.dist)} M`;
        if (text !== youText && youValueRef.current) {
          youText = text;
          youValueRef.current.textContent = text;
        }
      }
      let cardBox: { top: number; right: number; bottom: number } | null = null;
      if (card && openBox && cardSize) {
        const [cw = 0, ch = 0] = cardSize;
        // Keep clear of the open settings rail.
        const rightLimit = settingsRail
          ? settingsRail.left - layerBox.left - 8
          : layerBox.width - 16;
        const x = Math.max(
          16,
          Math.min((gaugeRight ?? openBox.right) - layerBox.left + 8, rightLimit - cw),
        );
        const labelMid = openBox.top + openBox.height / 2 - layerBox.top;
        const y = Math.max(52, Math.min(labelMid - 28, layerBox.height - ch - 16));
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
        const top = layerBox.top + y;
        cardBox = { top, right: layerBox.left + x + cw, bottom: top + ch };
      }

      /* The ring and its leader. */
      const target = lit ? 1 : 0;
      const k = 1 - Math.exp(-dt / RING_EASE);
      ringA += (target - ringA) * k;
      if (Math.abs(target - ringA) < RING_SETTLED) ringA = target;
      if (!ringId || ringA <= RING_HIDDEN) {
        clearRing();
        return ringA !== target;
      }
      const tr = pinRadius(ringId, state.spin);
      ringR = ringR < 0.2 ? tr : ringR + (tr - ringR) * k;
      if (Math.abs(tr - ringR) < RING_SETTLED * tr) ringR = tr;
      const easing = ringA !== target || ringR !== tr;
      drawOverHole(ctx, fit);
      const color = PIN_RING_COLOR[ringId];
      drawRing(cam, ctx, ringR, color, width, height, ringA);
      ringDrawn = true;

      // Leader: a hairline from the gauge label (or its open card) to the ring.
      if (!leaderBox) return easing;
      let ax = leaderBox.right + 6 - holeBox.left;
      let ay = leaderBox.top + leaderBox.height / 2 - holeBox.top;
      if (cardBox && openId === ringId) {
        ax = cardBox.right + 4 - holeBox.left;
        ay =
          Math.max(
            cardBox.top + 24,
            Math.min(leaderBox.top + leaderBox.height / 2, cardBox.bottom - 24),
          ) - holeBox.top;
      }
      const end = ringTarget(cam, ringId, ringR, ax, ay, width, height);
      if (!end) return easing;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 * ringA;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.globalAlpha = ringA;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return easing;
    };
    const loop = overlayLoop(frames, frame);
    const boxes = overlayFit(layer, canvas, loop.wake);
    wakeRef.current = loop.wake;
    return () => {
      wakeRef.current = null;
      loop.dispose();
      boxes.dispose();
    };
  }, [guideOpen, clocksOpen, mapOpen, cam, frames]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isSceneShortcut(e, { controls: true })) return;
      const s = useBlackHole.getState();
      if (!s.activePin) return;
      e.preventDefault();
      s.setActivePin(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openPin(id: PinId) {
    if (active === id) {
      setActivePin(null);
      return;
    }
    setActivePin(id);
  }

  if (guideOpen || clocksOpen || mapOpen) return null;

  const labels: Record<PinId, string> = {
    horizon: t("pinHorizon"),
    photon: t("pinPhoton"),
    isco: t("pinIsco"),
    doppler: t("pinDoppler"),
  };
  const radii = PIN_IDS.map((id) => pinRadius(id, spin));
  const tickY = radii.map((r) => (1 - gaugeFraction(r)) * railH);
  const labelY = spreadLabels(tickY, LABEL_GAP, railH);
  const horizonY = tickY[PIN_IDS.indexOf("horizon")] ?? railH;

  return (
    <>
      <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        />

        <div
          role="group"
          data-coach="gauge"
          aria-label={t("gaugeLabel")}
          className={cn(
            "absolute top-[calc(50%-5rem)] left-[max(1rem,env(safe-area-inset-left))] w-40 -translate-y-1/2 md:top-1/2 md:w-48 short:top-3 short:translate-y-0",
            active && "not-md:invisible",
          )}
        >
          <p
            aria-hidden
            className="gauge-label mb-3 flex items-baseline gap-2 font-mono text-[0.6875rem] tracking-widest uppercase"
          >
            <span className="text-space-muted">{t("gaugeYou")}</span>
            <span ref={youValueRef} className="tracking-normal text-solar tabular-nums" />
          </p>
          <div ref={railRef} className="radial-gauge relative">
            {railH > 0 ? (
              <svg
                aria-hidden
                width={24}
                height={railH}
                className="absolute top-0 left-0 overflow-visible text-space-fg"
              >
                <line
                  x1={RAIL_X}
                  x2={RAIL_X}
                  y1={0}
                  y2={horizonY}
                  stroke="currentColor"
                  strokeOpacity={0.32}
                />
                <line
                  x1={RAIL_X}
                  x2={RAIL_X}
                  y1={horizonY}
                  y2={railH}
                  stroke="currentColor"
                  strokeOpacity={0.14}
                  strokeDasharray="1 3"
                />
                {GAUGE_TICKS.map(({ r, major }) => {
                  const y = (1 - gaugeFraction(r)) * railH;
                  return (
                    <line
                      key={r}
                      x1={RAIL_X - (major ? 3 : 1.5)}
                      x2={RAIL_X}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity={major ? 0.4 : 0.22}
                    />
                  );
                })}
                {PIN_IDS.map((id, i) => {
                  const lit = focus === id;
                  return (
                    <g key={id} stroke={PIN_RING_COLOR[id]} strokeOpacity={lit ? 1 : 0.7}>
                      <line x1={RAIL_X - 4} x2={RAIL_X + 5} y1={tickY[i]} y2={tickY[i]} />
                      <path
                        d={`M${RAIL_X + 5} ${tickY[i]} C${RAIL_X + 11} ${tickY[i]} ${RAIL_X + 11} ${labelY[i]} ${RAIL_X + 17} ${labelY[i]}`}
                        fill="none"
                        strokeOpacity={lit ? 0.8 : 0.35}
                      />
                    </g>
                  );
                })}
              </svg>
            ) : null}
            <span
              ref={youRef}
              aria-hidden
              className="absolute top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-solar shadow-[0_0_10px_var(--color-solar)] transition-opacity duration-500"
              style={{ left: RAIL_X, opacity: railH > 0 ? 1 : 0 }}
            />
            {railH > 0
              ? PIN_IDS.map((id, i) => {
                  const r = radii[i] ?? 0;
                  const lit = focus === id;
                  return (
                    <button
                      key={id}
                      ref={(el) => {
                        labelRefs.current[id] = el;
                      }}
                      type="button"
                      aria-label={`${labels[id]} - r = ${r.toFixed(2)} M`}
                      aria-expanded={active === id}
                      onClick={() => openPin(id)}
                      onPointerEnter={() => setHover(id)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(id)}
                      onBlur={() => setHover(null)}
                      style={{ top: labelY[i] }}
                      className={cn(
                        "gauge-label pointer-events-auto absolute left-5 flex h-11 max-w-[calc(100%-1.25rem)] min-w-11 -translate-y-1/2 items-center gap-2 rounded-sm px-1 font-mono text-[0.6875rem] tracking-widest uppercase outline-hidden transition-[color,top] duration-500 focus-visible:ring-1 focus-visible:ring-ring",
                        lit ? "text-space-fg" : "text-space-muted hover:text-space-fg",
                      )}
                    >
                      <span className="truncate">{labels[id]}</span>
                      <span className="hidden shrink-0 tracking-normal whitespace-nowrap text-space-muted normal-case tabular-nums md:inline">
                        {formatR(r)} M
                      </span>
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      </div>

      {active ? (
        <aside
          ref={cardRef}
          aria-label={labels[active]}
          className="pin-card lesson-card no-scrollbar anim-rise pointer-events-auto absolute z-[55] hidden overflow-y-auto rounded-lg p-4 md:block"
        >
          <PinFocus key={active}>
            <PinLesson id={active} spin={spin} onClose={() => setActivePin(null)} />
          </PinFocus>
        </aside>
      ) : null}
    </>
  );
}

/** The desktop lesson takes focus from its pin and gives it back when it closes. */
function PinFocus({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useFocusHandoff(root);
  return (
    <div ref={root} tabIndex={-1} className="anim-fade outline-hidden">
      {children}
    </div>
  );
}
