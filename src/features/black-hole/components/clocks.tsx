import { ChevronDown, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  DROP_START,
  FADE_LIFE,
  FLASH_LIFE,
  FLASH_PERIOD,
  RAIN_FLOOR,
  SPEEDS,
  beaconColor,
  freshDrops,
  rgba,
  type Drop,
  type SpeedId,
} from "@/features/black-hole/lib/clocks";
import { rainDrDt, rainRedshift } from "@/features/black-hole/lib/physics";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { projectWorld } from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import {
  Chip,
  Equation,
  IconButton,
  Kicker,
  PanelHeader,
  Sub,
  Tooltip,
  useFocusHandoff,
} from "@horizon/toolkit/ui";

import { ClockRow } from "./clock-row";
import { drawOverHole, overlayFit, overlayLoop } from "./overlay-canvas";
import { useSceneCamera, useSceneFrames } from "./scene-camera";

const PULSE: Keyframe[] = [
  { transform: "scale(1.9)", opacity: 1 },
  { transform: "scale(1)", opacity: 0.4 },
];

export function ClockDrops() {
  const open = useBlackHole((s) => s.clocksOpen);
  const [run, setRun] = useState(0);
  const [speed, setSpeed] = useState<SpeedId>("slow");

  // Keep the selected pace, but give every opening/drop a fresh simulation.
  return open ? (
    <ClockRun
      key={run}
      speed={speed}
      onSpeedChange={setSpeed}
      onRestart={() => setRun((n) => n + 1)}
    />
  ) : null;
}

type RowRefs = {
  row: HTMLLIElement | null;
  dot: HTMLSpanElement | null;
  label: HTMLSpanElement | null;
  bar: HTMLSpanElement | null;
  rate: HTMLSpanElement | null;
};

function ClockRun({
  speed,
  onSpeedChange,
  onRestart,
}: {
  speed: SpeedId;
  onSpeedChange: (speed: SpeedId) => void;
  onRestart: () => void;
}) {
  const cam = useSceneCamera();
  const frames = useSceneFrames();
  const t = useTranslations("blackHole");
  const setOpen = useBlackHole((s) => s.setClocksOpen);
  const layerRef = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useFocusHandoff(panel, () => document.querySelector<HTMLElement>('[data-return="clocks"]'));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const youDotRef = useRef<HTMLSpanElement>(null);
  const rowRefs = useRef<RowRefs[]>(
    DROP_START.map(() => ({ row: null, dot: null, label: null, bar: null, rate: null })),
  );
  const hoverRef = useRef<number | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const drops = useRef<Drop[]>(freshDrops());
  const speedRef = useRef(2.2);
  useEffect(() => {
    speedRef.current = SPEEDS.find((s) => s.id === speed)?.rate ?? 2.2;
  }, [speed]);

  useEffect(() => {
    drops.current = freshDrops();
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!layer || !canvas || !ctx) return;
    const sceneText = getComputedStyle(canvas).getPropertyValue("--color-space-fg").trim();
    let youPhase = 0;
    const shown = drops.current.map(() => ({ label: "", rate: "", gone: false }));
    const reduce = prefersReducedMotion();

    const pulse = (el: HTMLElement | null) => {
      if (!el || reduce) return;
      el.animate(PULSE, { duration: 700, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" });
    };

    /* The clocks fall while the scene animates, when the engine draws every frame; paused, they
       redraw only when the camera moves. */
    const frame = (dt: number) => {
      // Reduced motion starts paused (store); resuming is the user's explicit choice.
      const realDt = useBlackHole.getState().animationPaused ? 0 : dt;
      const dT = speedRef.current * realDt;

      youPhase += realDt / FLASH_PERIOD;
      if (youPhase >= 1) {
        youPhase -= 1;
        pulse(youDotRef.current);
      }

      drops.current.forEach((d, i) => {
        for (const f of d.flashes) f.age += realDt;
        d.flashes = d.flashes.filter((f) => f.age < FLASH_LIFE);
        if (d.gone) {
          d.fade += realDt;
          return;
        }
        const rate = rainRedshift(d.r);
        d.r += rainDrDt(d.r) * dT;
        d.tau += rate * dT;
        d.phase += (rate * realDt) / FLASH_PERIOD;
        if (d.phase >= 1) {
          d.phase -= 1;
          d.flashes.push({ r: d.r, age: 0, rate });
          pulse(rowRefs.current[i]?.dot ?? null);
        }
        if (d.r <= RAIN_FLOOR) {
          d.r = RAIN_FLOOR;
          d.gone = true;
        }
      });

      // Card readout: only touch the DOM when a displayed value changes.
      drops.current.forEach((d, i) => {
        const refs = rowRefs.current[i];
        const was = shown[i];
        if (!refs || !was) return;
        // A stopped clock keeps the rate it had at the floor: dτ/dt never reaches zero outside r = 2M.
        const rate = rainRedshift(d.r);
        const label = `r ${d.r.toFixed(d.gone ? 2 : 1)}`;
        const rateText = `${rate.toFixed(2)}×`;
        if (label !== was.label && refs.label) refs.label.textContent = label;
        if (rateText !== was.rate) {
          if (refs.rate) refs.rate.textContent = rateText;
          if (refs.bar) refs.bar.style.transform = `scaleX(${rate})`;
          if (refs.dot) refs.dot.style.backgroundColor = rgba(beaconColor(rate), 1);
        }
        if (d.gone !== was.gone && refs.row) refs.row.style.opacity = d.gone ? "0.4" : "1";
        shown[i] = { label, rate: rateText, gone: d.gone };
      });

      const fit = boxes.fit();
      if (!fit) return false;
      drawOverHole(ctx, fit);
      const { width, height } = fit.holeBox;

      const camAz = Math.atan2(cam.posX, cam.posZ);
      const place = (r: number, spread: number) => {
        const phi = camAz + spread;
        return projectWorld(cam, r * Math.sin(phi), 0.16, r * Math.cos(phi), width, height);
      };

      drops.current.forEach((d, i) => {
        // Rings stay where each tick was emitted, so their spacing records the slowing.
        for (const f of d.flashes) {
          const s = place(f.r, d.spread);
          if (!s.visible) continue;
          const life = f.age / FLASH_LIFE;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 3 + 24 * life ** 0.6, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(beaconColor(f.rate), (1 - life) ** 2 * (0.2 + 0.6 * f.rate));
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (d.gone && d.fade >= FADE_LIFE) return;
        const s = place(d.r, d.spread);
        if (!s.visible) return;
        const rate = rainRedshift(d.r);
        const latest = d.flashes.at(-1);
        const boost = latest && latest.age < 0.3 ? 1 - latest.age / 0.3 : 0;
        const alpha = d.gone ? 0.5 * (1 - d.fade / FADE_LIFE) : 0.4 + 0.6 * rate;
        const color = beaconColor(rate);
        const glow = 9 + 7 * boost;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glow);
        g.addColorStop(0, rgba(color, alpha * (0.55 + 0.45 * boost)));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(color, Math.min(1, alpha + 0.2));
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.8 + 1.1 * boost, 0, Math.PI * 2);
        ctx.fill();

        if (hoverRef.current === i) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
          ctx.strokeStyle = `color-mix(in srgb, ${sceneText} 60%, transparent)`;
          ctx.stroke();
        }
      });
      return false;
    };
    const loop = overlayLoop(frames, frame);
    const boxes = overlayFit(layer, canvas, loop.wake);
    wakeRef.current = loop.wake;
    return () => {
      wakeRef.current = null;
      loop.dispose();
      boxes.dispose();
    };
  }, [cam, frames]);

  const restart = (
    <Tooltip label={t("dropAgain")} align="end">
      <IconButton type="button" onClick={onRestart} aria-label={t("dropAgain")}>
        <RotateCcw className="icon-toolbar" />
      </IconButton>
    </Tooltip>
  );

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />

      <aside
        aria-label={t("droppedClocks")}
        className="pad-hud-bottom pointer-events-auto absolute right-0 bottom-0 left-0 z-[55] md:right-auto md:w-[22rem] md:p-4"
      >
        <div
          ref={panel}
          tabIndex={-1}
          className="lesson-card no-scrollbar max-h-[38dvh] overflow-x-hidden overflow-y-auto rounded-panel p-3.5 outline-hidden md:max-h-[min(32rem,calc(100dvh-6rem))] md:p-4"
        >
          <PanelHeader
            kicker={t("rainObservers")}
            title={t("droppedClocks")}
            onClose={() => setOpen(false)}
            closeLabel={t("ariaCloseClocks")}
          />
          <p className="mt-2 text-sm leading-relaxed text-fg-primary/80">
            {t("clocksLead", { floor: RAIN_FLOOR })}
          </p>

          <ul
            aria-label={t("clocksRates")}
            className="mt-3 flex flex-col gap-1.5 font-mono text-xs tabular-nums"
          >
            <ClockRow
              dotRef={(el) => {
                youDotRef.current = el;
              }}
              label={t("gaugeYou")}
              you
            />
            {DROP_START.map((r, i) => (
              <ClockRow
                key={r}
                rowRef={(el) => {
                  const refs = rowRefs.current[i];
                  if (refs) refs.row = el;
                }}
                dotRef={(el) => {
                  const refs = rowRefs.current[i];
                  if (refs) refs.dot = el;
                }}
                labelRef={(el) => {
                  const refs = rowRefs.current[i];
                  if (refs) refs.label = el;
                }}
                barRef={(el) => {
                  const refs = rowRefs.current[i];
                  if (refs) refs.bar = el;
                }}
                rateRef={(el) => {
                  const refs = rowRefs.current[i];
                  if (refs) refs.rate = el;
                }}
                label={`r ${r.toFixed(1)}`}
                onHover={(on) => {
                  hoverRef.current = on ? i : null;
                  wakeRef.current?.();
                }}
              />
            ))}
          </ul>

          <Kicker className="mt-4">{t("pace")}</Kicker>
          <div className="mt-1.5 flex items-center gap-1">
            {SPEEDS.map((s) => (
              <Chip
                key={s.id}
                selected={speed === s.id}
                aria-pressed={speed === s.id}
                onClick={() => onSpeedChange(s.id)}
                className="flex-1 tracking-widest uppercase"
              >
                {s.id === "slow" ? t("slow") : s.id === "fast" ? t("fast") : t("classPace")}
              </Chip>
            ))}
            {restart}
          </div>

          <details className="group mt-3 border-t border-border pt-1">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between font-mono text-xs tracking-widest text-fg-tertiary uppercase transition-colors duration-feedback ease-standard hover:text-fg-primary md:h-8 [&::-webkit-details-marker]:hidden">
              {t("clocksMore")}
              <ChevronDown className="icon size-icon-compact transition-transform duration-control ease-standard group-open:rotate-180" />
            </summary>
            <p className="mt-1 text-sm leading-relaxed text-fg-primary/80">{t("clocksP1")}</p>
            <Equation>
              (dτ/dt)<Sub>{t("rainSymbol")}</Sub> = 1 − 2M/r
            </Equation>
            <Equation>
              (dτ/dt)<Sub>{t("hoverSymbol")}</Sub> = √(1 − 2M/r)
            </Equation>
            <p className="text-sm leading-relaxed text-fg-primary/80">{t("clocksP2")}</p>
          </details>
        </div>
      </aside>
    </div>
  );
}
