import * as SliderPrimitive from "@radix-ui/react-slider";
import { Gauge } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { asideOpen } from "@/lib/scene-store";
import { cn } from "@horizon/toolkit/ui";

import { useVoyage } from "../lib/store";

const release = () => useVoyage.getState().setBraking(false);

/**
 * The brake under the lever, for touch (the keys have X): held, it burns against the motion
 * relative to the body until the ship is at rest there. Letting go, or the button leaving with
 * the manual flight, lets it off.
 */
function BrakeButton() {
  const t = useTranslations("voyage");
  const braking = useVoyage((s) => s.braking);
  useEffect(() => release, []);
  return (
    <button
      type="button"
      aria-label={t("hud.brakeHold")}
      aria-pressed={braking}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        useVoyage.getState().setBraking(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        "-mx-1 hidden h-11 w-12 touch-none rounded-sm border border-border font-mono text-[10px] tracking-[0.14em] uppercase transition-colors duration-150 select-none pointer-coarse:block",
        braking ? "bg-accent text-accent-fg" : "text-fg",
      )}
    >
      {t("hud.brake")}
    </button>
  );
}

/**
 * The throttle lever down the left, where a pilot's left hand rests: thrust ahead, kept where
 * it is set. Opening it in orbit takes the helm; entering orbit closes it. Beside its track a
 * gauge shows what the drive gives now, keys and stick included (`--voyage-push`, written by
 * the cockpit). It waits while the autopilot flies, and steps aside for a phone's panels.
 * Flown by hand on a touch screen, the brake sits under it.
 */
export function ThrottleLever() {
  const t = useTranslations("voyage");
  const throttle = useVoyage((s) => s.throttle);
  const flying = useVoyage((s) => s.flying);
  const manual = useVoyage((s) => s.mode === "free" && !s.flying && s.crash === null);
  const aside = useVoyage(asideOpen);
  const percent = Math.round(throttle * 100);
  return (
    <div
      data-coach="throttle"
      className={cn(
        "voyage-holo pointer-events-auto absolute top-1/2 left-(--hud-gutter) z-30 flex -translate-y-1/2 flex-col items-center gap-2 px-1 py-3",
        aside && "not-md:hidden",
        flying && "opacity-50",
      )}
    >
      <span aria-hidden="true" className="font-mono text-[10px] text-fg tabular-nums">
        {percent}
      </span>
      <div className="relative h-32 w-10 md:h-40 short:h-20">
        <span
          aria-hidden="true"
          className="voyage-push absolute top-[5px] bottom-[5px] left-[calc(50%+14px)] w-0.5 rounded-full bg-accent"
        />
        <SliderPrimitive.Root
          orientation="vertical"
          min={0}
          max={100}
          step={5}
          value={[percent]}
          disabled={flying}
          onValueChange={([value = 0]) => useVoyage.getState().setThrottle(value / 100)}
          className="relative flex h-full w-10 touch-none flex-col items-center select-none not-md:after:absolute not-md:after:-inset-x-1 not-md:after:inset-y-0"
        >
          <SliderPrimitive.Track className="relative w-px grow rounded-full bg-fg/20">
            <SliderPrimitive.Range className="absolute w-full bg-accent/60" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label={t("hud.throttle")}
            aria-valuetext={t("hud.throttleValue", { value: percent })}
            className="block h-2.5 w-7 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--solar)/0.45)] outline-hidden transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-95"
          />
        </SliderPrimitive.Root>
      </div>
      <Gauge aria-hidden="true" className="size-3.5 text-subtle" />
      {manual ? <BrakeButton /> : null}
    </div>
  );
}
