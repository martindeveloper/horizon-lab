import { ChevronLeft, ChevronRight, Pause } from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { figureArgs } from "@/features/black-hole/lib/figures";
import { PRESETS } from "@/features/black-hole/lib/holes";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { Kicker, cn } from "@horizon/toolkit/ui";

export function StoryLine({ alwaysOpen = false }: { alwaysOpen?: boolean }) {
  const presetId = useBlackHole((s) => s.presetId);
  return <StoryContent key={`${presetId}:${alwaysOpen}`} alwaysOpen={alwaysOpen} />;
}

function StoryContent({ alwaysOpen }: { alwaysOpen: boolean }) {
  const t = useTranslations("blackHole");
  const messages = useMessages();
  const presetId = useBlackHole((s) => s.presetId);
  const storyKey = t.has(`stories.${presetId}`) ? presetId : "custom";
  const figures = figureArgs(useLocale());
  const stories = Object.keys(messages.blackHole.stories[storyKey]).map((index) => ({
    kicker: t(`stories.${storyKey}.${index}.kicker`, figures),
    title: t(`stories.${storyKey}.${index}.title`, figures),
    body: t(`stories.${storyKey}.${index}.body`, figures),
  }));
  const kind = useBlackHole((s) => PRESETS.find((p) => p.id === s.presetId)?.kind);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(alwaysOpen);
  // Rotation pauses while the reader hovers or focuses the story, and stops for
  // good once they take control (WCAG 2.2.2).
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const full = alwaysOpen || open;
  const story = stories[index] ?? stories[0]!;
  const bodyId = useId();
  const rotating = !full && !held && stories.length > 1;
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const hold = () => setPaused(true);
    const release = () => setPaused(false);
    const leave = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node) || !el.contains(e.relatedTarget)) setPaused(false);
    };
    el.addEventListener("pointerenter", hold);
    el.addEventListener("pointerleave", release);
    el.addEventListener("focusin", hold);
    el.addEventListener("focusout", leave);
    return () => {
      el.removeEventListener("pointerenter", hold);
      el.removeEventListener("pointerleave", release);
      el.removeEventListener("focusin", hold);
      el.removeEventListener("focusout", leave);
    };
  }, []);

  useEffect(() => {
    if (!rotating || paused) return;
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setIndex((n) => (n + 1) % stories.length);
    }, 14000);
    return () => window.clearInterval(id);
  }, [presetId, stories.length, rotating, paused]);

  function show(next: number) {
    setHeld(true);
    setIndex(((next % stories.length) + stories.length) % stories.length);
  }

  return (
    <article ref={root} className="pointer-events-auto min-w-0">
      <div className="flex items-center gap-2">
        <Kicker className="not-md:text-caption">
          {/* Phones name the kind in the dock's own kicker above. */}
          {kind ? (
            <span className="not-md:hidden">
              {`${kind === "catalog" ? t("kindCatalog") : t("kindTheory")}  ·  `}
            </span>
          ) : null}
          {story.kicker}
        </Kicker>
        {stories.length > 1 ? (
          <div className="ml-auto flex items-center">
            {stories.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t("storyNumber", { number: i + 1 })}
                aria-current={i === index ? "step" : undefined}
                className="hidden size-6 items-center justify-center rounded-full ui-focus md:flex"
                onClick={() => show(i)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    i === index ? "bg-fg-primary" : "bg-fg-primary/50",
                  )}
                />
              </button>
            ))}
            {rotating ? (
              <button
                type="button"
                className="relative flex h-8 w-11 items-center justify-center rounded-full ui-press text-fg-tertiary ui-quiet ui-focus transition-colors duration-feedback ease-standard not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-1.5 md:size-8"
                aria-label={t("pauseStories")}
                onClick={() => setHeld(true)}
              >
                <Pause className="icon size-icon-compact" />
              </button>
            ) : null}
            <button
              type="button"
              className="relative flex h-8 w-11 items-center justify-center rounded-full ui-press text-fg-tertiary ui-quiet ui-focus transition-colors duration-feedback ease-standard not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-1.5 md:size-8"
              aria-label={t("previousStory")}
              onClick={() => show(index - 1)}
            >
              <ChevronLeft className="icon size-icon-compact" />
            </button>
            <button
              type="button"
              className="relative flex h-8 w-11 items-center justify-center rounded-full ui-press text-fg-tertiary ui-quiet ui-focus transition-colors duration-feedback ease-standard not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-1.5 md:size-8"
              aria-label={t("nextStory")}
              onClick={() => show(index + 1)}
            >
              <ChevronRight className="icon size-icon-compact" />
            </button>
          </div>
        ) : null}
      </div>
      {/* Announced only when the reader changed the story, not on auto-rotation. */}
      <div aria-live={held ? "polite" : "off"}>
        <div key={`${presetId}-${story.title}`} className="anim-fade">
          <h2 className="font-display text-body/5 font-medium tracking-tight text-fg-primary md:text-panel md:leading-normal">
            {story.title}
          </h2>
          <p
            id={bodyId}
            className={cn(
              "mt-1 text-body text-fg-secondary not-md:text-detail not-md:leading-normal short:hidden",
              !full && "line-clamp-2",
              open &&
                !alwaysOpen &&
                "max-h-[28dvh] overflow-x-hidden overflow-y-auto overscroll-contain",
            )}
          >
            {story.body}
          </p>
        </div>
      </div>
      {alwaysOpen ? null : (
        <button
          type="button"
          className="relative mt-1.5 inline-flex min-h-6 items-center font-mono text-ui tracking-label text-fg-tertiary ui-quiet uppercase ui-focus transition-colors duration-feedback ease-standard after:absolute after:-inset-x-2 after:-inset-y-2.5 short:hidden"
          onClick={() => {
            setHeld(true);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          {open ? t("fold") : t("read")}
        </button>
      )}
    </article>
  );
}
