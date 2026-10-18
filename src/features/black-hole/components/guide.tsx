import { useReducedMotion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  GuideBody,
  GuideCard,
  GuideEquation,
  GuideTitle,
} from "@/components/simulations/guide-card";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { flightPhase, tourFor, type TourBeat } from "@/features/black-hole/lib/tours";
import { isSceneShortcut } from "@horizon/toolkit/ui";
import { TextReveal, textStagger } from "@horizon/toolkit/ui/motion";

import { GuideSketch } from "./guide-sketch";

function revealMs(beat: TourBeat) {
  const titleDelay = 0.12;
  const bodyDelay = titleDelay + beat.title.length * 0.022 + 0.18;
  const eqDelay =
    bodyDelay + beat.body.length * Math.min(0.014, 2.4 / Math.max(beat.body.length, 1)) + 0.2;
  const last = beat.eq ?? beat.body;
  const lastDelay = beat.eq ? eqDelay : bodyDelay;
  const lastStagger = textStagger(last, beat.eq ? 18 : 14);
  return lastDelay + Math.max(last.length - 1, 0) * lastStagger + 0.4;
}

export function GuideOverlay() {
  const locale = useLocale();
  const presetId = useBlackHole((s) => s.presetId);
  const beatIndex = useBlackHole((s) => s.guideBeat);
  const arrived = useBlackHole((s) => s.guideArrived);
  const reduce = Boolean(useReducedMotion());

  // The header and its Guide button remount when the tour ends; hand focus back to it.
  useEffect(
    () => () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      document.querySelector<HTMLElement>('[data-return="guide"]')?.focus({ preventScroll: true });
    },
    [],
  );

  // Each flight/reveal phase owns its timers and input readiness. Replacing the
  // phase cancels old timers and resets state before the next frame is shown.
  return (
    <>
      <GuideSketch />
      <GuideStep key={`${presetId}:${beatIndex}:${locale}:${arrived}:${reduce}`} />
    </>
  );
}

function GuideStep() {
  const t = useTranslations("blackHole");
  const presetId = useBlackHole((s) => s.presetId);
  const beatIndex = useBlackHole((s) => s.guideBeat);
  const arrived = useBlackHole((s) => s.guideArrived);
  const endGuide = useBlackHole((s) => s.endGuide);
  const reduce = useReducedMotion();
  const beats = useMemo(() => {
    const key = t.has(`tours.${presetId}`) ? presetId : "custom";
    return tourFor(presetId).map((pose, index): TourBeat => ({
      ...pose,
      kicker: t(`tours.${key}.${index}.kicker`),
      title: t(`tours.${key}.${index}.title`),
      body: t(`tours.${key}.${index}.body`),
      phase: t.has(`tours.${key}.${index}.phase`) ? t(`tours.${key}.${index}.phase`) : "Transit",
    }));
  }, [presetId, t]);
  const beat = beats[beatIndex] ?? beats[0]!;
  const last = beatIndex >= beats.length - 1;
  const rawPhase = flightPhase(beat);
  const phase =
    rawPhase === "Wide"
      ? t("phaseWide")
      : rawPhase === "Dolly"
        ? t("phaseDolly")
        : rawPhase === "Detail"
          ? t("phaseDetail")
          : rawPhase === "Hold"
            ? t("phaseHold")
            : t("phaseTransit");
  const titleDelay = 0.12;
  const bodyDelay = titleDelay + beat.title.length * 0.022 + 0.18;
  const eqDelay =
    bodyDelay + beat.body.length * Math.min(0.014, 2.4 / Math.max(beat.body.length, 1)) + 0.2;
  const [skip, setSkip] = useState(false);
  const [ready, setReady] = useState(Boolean(arrived && reduce));
  const readyRef = useRef(Boolean(arrived && reduce));

  useEffect(() => {
    if (arrived) return;
    const current = beats;
    const step = current[beatIndex] ?? current[0]!;
    const ms = reduce ? 60 : Math.round(step.duration * 1000);
    const id = window.setTimeout(() => {
      useBlackHole.getState().setGuideArrived(true);
    }, ms);
    return () => window.clearTimeout(id);
  }, [beatIndex, beats, arrived, reduce]);

  useEffect(() => {
    if (!arrived || reduce) return;
    const current = beats;
    const step = current[beatIndex] ?? current[0]!;
    const id = window.setTimeout(
      () => {
        readyRef.current = true;
        setReady(true);
      },
      revealMs(step) * 1000,
    );
    return () => window.clearTimeout(id);
  }, [beatIndex, beats, arrived, reduce]);

  function onContinue() {
    const s = useBlackHole.getState();
    if (!s.guideOpen) return;
    // Mid-flight, land the shot: the card appears while the camera finishes its move.
    if (!s.guideArrived) {
      s.setGuideArrived(true);
      return;
    }
    if (!readyRef.current) {
      readyRef.current = true;
      setSkip(true);
      setReady(true);
      return;
    }
    s.advanceGuide();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space" && e.key !== "ArrowRight") return;
      // Space on a button presses that button; the tour only takes it from the scene.
      if (e.repeat || !isSceneShortcut(e)) return;
      e.preventDefault();
      onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Each beat is a new card: move focus to its heading so it is read, and Space keeps working.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (arrived) heading.current?.focus({ preventScroll: true });
  }, [arrived]);

  const instant = skip || Boolean(reduce);
  const canAdvance = ready || instant;
  const prompt = last ? t("finish") : t("continue");

  return (
    <div className="pointer-events-none absolute inset-0 z-[70]">
      {/* While the camera flies there is no card yet: the move and a way out, up top. */}
      {arrived ? null : (
        <header className="pad-hud-top absolute inset-x-0 top-0 z-20 flex items-center justify-between">
          <p className="glass-hud rounded-full px-3 py-1.5 font-mono text-xs tracking-widest text-fg uppercase">
            {phase} · {beatIndex + 1} / {beats.length}
          </p>
          <button
            type="button"
            className="glass-hud pointer-events-auto relative h-8 rounded-full px-3 text-xs tracking-widest text-fg uppercase transition-opacity duration-300 not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-1.5 hover:opacity-80"
            onClick={endGuide}
          >
            {t("exit")}
          </button>
        </header>
      )}

      <button
        type="button"
        className="pointer-events-auto absolute inset-0 z-0 cursor-pointer"
        aria-label={!arrived ? t("skip") : canAdvance ? prompt : t("ariaShowText")}
        onClick={onContinue}
      />

      {arrived ? (
        <GuideCard
          label={t("guide")}
          kicker={t("guideProgress", {
            step: beatIndex + 1,
            total: beats.length,
            kicker: beat.kicker,
          })}
          stepKey={`${presetId}-${beatIndex}`}
          live={false}
          className="z-10"
          controls={{
            previous: {
              label: t("previousBeat"),
              disabled: beatIndex === 0,
              onClick: () => useBlackHole.getState().previousGuide(),
            },
            next: { label: canAdvance ? prompt : t("skip"), last, onClick: onContinue },
            exit: { label: t("exit"), onClick: endGuide },
          }}
        >
          <GuideTitle ref={heading}>
            <TextReveal text={beat.title} delay={titleDelay} ms={22} instant={instant} />
          </GuideTitle>
          <GuideBody>
            <TextReveal text={beat.body} delay={bodyDelay} ms={14} instant={instant} />
          </GuideBody>
          {beat.eq ? (
            <GuideEquation>
              <TextReveal text={beat.eq} delay={eqDelay} ms={18} instant={instant} />
            </GuideEquation>
          ) : null}
        </GuideCard>
      ) : null}
    </div>
  );
}
