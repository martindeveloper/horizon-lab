import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { SimulationManifest } from "@/lib/simulation-types";
import { experiences, labs } from "@/lib/simulations";
import { cn, kickerClass, Tilt } from "@horizon/toolkit/ui";

import { HeroScene } from "./hero-sun";
import { TileLink } from "./tile-link";
import { EXPERIENCE_FRAME, TILE_FRAME, tileSpan } from "./tiles";

type Translate = Awaited<ReturnType<typeof getTranslations<"catalogue">>>;

/**
 * A tile is one world: the artwork fills it, the category and plate number
 * sit on the scene, and a frosted panel rests on the art with the name, one
 * sentence, the one solar action and the entry points. Labels are instrument
 * readouts with rules, not pills. With a mouse the tile tilts toward the
 * pointer: the art drifts behind, the copy floats in front. An experience's
 * tile is shorter, its panel narrower, so more of the art shows.
 */
function SimulationTile({
  simulation,
  index,
  count,
  order,
  t,
}: {
  simulation: SimulationManifest;
  index: number;
  count: number;
  /** Its place among every tile on the page, for the opening's stagger. */
  order: number;
  t: Translate;
}) {
  const key = simulation.messageKey;
  const experience = simulation.kind === "experience";
  return (
    <Tilt
      style={{ "--i": order }}
      className={cn(
        "intro-tile",
        experience ? EXPERIENCE_FRAME : TILE_FRAME,
        tileSpan(index, count),
      )}
    >
      <article className="simulation-tile glass-edge group focus-within:solar-ring hover:solar-ring relative isolate flex h-full min-h-[inherit] flex-col justify-between overflow-hidden rounded-3xl bg-space">
        <div className="catalogue-art tilt-back absolute -inset-3">
          <Image
            src={simulation.artwork}
            alt=""
            fill
            sizes="(min-width: 1280px) 58vw, (min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            priority={index === 0}
          />
        </div>

        {/* The whole tile opens the simulation; the visible link below is the one that takes focus. */}
        <TileLink href={simulation.href} className="absolute inset-0 z-10 rounded-3xl" />

        <div className="tilt-front pointer-events-none relative z-20 flex items-start justify-between gap-6 p-5 sm:p-6">
          <span className="mt-2 inline-flex items-center gap-3 font-mono text-[10px] tracking-[0.24em] text-space-muted uppercase">
            <span className="h-px w-8 bg-solar/70" aria-hidden />
            {t(`${key}.category`)}
          </span>
          <span
            className="font-mono text-3xl font-light text-solar/80 tabular-nums sm:text-4xl"
            aria-hidden
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="tilt-front pointer-events-none relative z-20 p-3 sm:p-4">
          <div
            className={cn(
              "cover-panel pointer-events-auto relative rounded-2xl p-5 sm:p-6",
              experience && "lg:max-w-2xl",
            )}
          >
            <TileLink href={simulation.href} className="absolute inset-0 rounded-2xl" />
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
              {t(`${key}.eyebrow`)}
            </p>
            <h3
              id={`tile-${simulation.id}`}
              className="mt-2 font-headline text-3xl leading-[1.05] font-medium tracking-[-0.015em] text-balance sm:text-4xl xl:text-5xl"
            >
              {t(`${key}.title`)}
            </h3>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-pretty text-muted">
              {t(`${key}.description`)}
            </p>
            {/* Each highlight carries its own marker, so a wrapped line starts like the first. */}
            <ul
              className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] tracking-wide text-subtle"
              aria-label={t("features")}
            >
              {simulation.highlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {t(`${key}.${highlight}`)}
                </li>
              ))}
            </ul>
            <div className="relative z-10 mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4">
              <Link
                href={simulation.href}
                prefetch={false}
                className="action-fill inline-flex h-11 shrink-0 items-center gap-2 rounded-full pr-4 pl-5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-hidden motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-0.5"
              >
                {t(`${key}.open`)}
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
              {simulation.entryPoints.length ? (
                <nav aria-label={`${t("startFrom")}: ${t(`${key}.title`)}`} className="min-w-0">
                  <ul className="flex flex-wrap gap-x-5">
                    {simulation.entryPoints.map((entry, entryIndex) => (
                      <li key={entry.id}>
                        <Link
                          href={entry.href}
                          prefetch={false}
                          className="inline-flex min-h-11 items-baseline gap-2 rounded-sm py-3 text-sm text-muted transition-colors hover:text-fg focus-visible:text-fg focus-visible:underline focus-visible:decoration-accent focus-visible:decoration-2 focus-visible:underline-offset-4 focus-visible:outline-hidden"
                        >
                          <span
                            className="font-mono text-[10px] text-accent tabular-nums"
                            aria-hidden
                          >
                            {String(entryIndex + 1).padStart(2, "0")}
                          </span>
                          {t(`${key}.entryPoints.${entry.id}.title`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </Tilt>
  );
}

/**
 * One shelf of tiles under a quiet heading: a gold rule and a mono label, and for the
 * experiences one line on what sets them apart. The labs come first, as the bento; the
 * experiences follow, a little apart, on shorter tiles.
 */
function Shelf({
  id,
  title,
  note,
  shelf,
  offset,
  className,
  t,
}: {
  id: string;
  title: string;
  note?: string;
  shelf: readonly SimulationManifest[];
  offset: number;
  className?: string;
  t: Translate;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn("app-container", className)}>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 sm:mb-6">
        <h2
          id={`${id}-heading`}
          className={cn(
            "inline-flex items-center gap-3 text-[11px] tracking-[0.24em]",
            kickerClass,
          )}
        >
          <span className="h-px w-8 bg-solar/70" aria-hidden />
          {title}
        </h2>
        {note ? <p className="text-sm text-muted">{note}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 lg:gap-6">
        {shelf.map((simulation, index) => (
          <SimulationTile
            key={simulation.id}
            simulation={simulation}
            index={index}
            count={shelf.length}
            order={offset + index}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

export async function Catalogue({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "catalogue" });
  return (
    <main id="main-content" tabIndex={-1} className="catalogue-intro pb-10 outline-hidden">
      <section aria-labelledby="catalogue-heading" className="catalogue-hero relative isolate">
        <HeroScene locale={locale} sunLabel={t("sun")} moonLabel={t("moon")} skyLabel={t("sky")}>
          <p className={cn("intro-kicker inline-flex items-center gap-3", kickerClass)}>
            <span className="h-px w-8 bg-solar/70" aria-hidden />
            {t("available", { labs: labs.length, experiences: experiences.length })}
          </p>
          <h1
            id="catalogue-heading"
            className="intro-title mt-5 max-w-[13ch] font-headline text-5xl leading-[0.95] font-medium tracking-[-0.025em] text-balance sm:text-6xl lg:max-w-[16ch] lg:text-[clamp(4.75rem,7.8vw,8.5rem)] lg:leading-[0.9] lg:tracking-[-0.03em] lg:[&_em]:block"
          >
            {t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
        </HeroScene>
      </section>

      <Shelf id="labs" title={t("labs")} t={t} shelf={labs} offset={0} />
      {experiences.length ? (
        <Shelf
          id="experiences"
          title={t("experiences")}
          note={t("experiencesNote")}
          t={t}
          shelf={experiences}
          offset={labs.length}
          className="mt-20 sm:mt-28"
        />
      ) : null}
    </main>
  );
}
