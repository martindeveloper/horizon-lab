import { motion, useReducedMotion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useBlackHole } from "@/features/black-hole/lib/store";
import { flightPhase, tourFor, type TourBeat } from "@/features/black-hole/lib/tours";
import { isSceneShortcut, kickerClass } from "@horizon/toolkit/ui";
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

      <button
        type="button"
        className="pointer-events-auto absolute inset-0 z-0 cursor-pointer"
        aria-label={!arrived ? t("skip") : canAdvance ? prompt : t("ariaShowText")}
        onClick={onContinue}
      />

      {arrived ? (
        <div className="pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <motion.div
            key={`${presetId}-${beatIndex}`}
            initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: instant ? 0.2 : 0.72,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="guide-card glass-panel pointer-events-auto mx-auto max-w-xl overflow-y-auto overscroll-contain rounded-lg p-3.5 md:p-4"
          >
            <TextReveal text={beat.kicker} className={kickerClass} ms={28} instant={instant} />
            <h2
              ref={heading}
              tabIndex={-1}
              className="mt-1 font-display text-lg font-medium tracking-tight text-fg outline-hidden md:text-2xl"
            >
              <TextReveal text={beat.title} delay={titleDelay} ms={22} instant={instant} />
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted md:mt-2">
              <TextReveal text={beat.body} delay={bodyDelay} ms={14} instant={instant} />
            </p>
            {beat.eq ? (
              <p className="mt-3 overflow-x-auto text-center font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg md:text-sm">
                <TextReveal text={beat.eq} delay={eqDelay} ms={18} instant={instant} />
              </p>
            ) : null}
            <motion.button
              type="button"
              onClick={onContinue}
              className="glass-hud relative mt-3 flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full font-mono text-xs tracking-widest text-fg uppercase transition-opacity duration-300 after:absolute after:inset-x-0 after:-inset-y-0.5 hover:opacity-80 md:mt-4"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: instant ? 0 : eqDelay + 0.4, duration: 0.5 }}
            >
              {canAdvance ? prompt : t("skip")}
              <kbd className="hidden rounded border border-border-strong px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted md:inline">
                {t("spaceKey")}
              </kbd>
            </motion.button>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
