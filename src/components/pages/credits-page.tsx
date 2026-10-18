import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import creditDocuments from "@/data/credits.generated.json";
import type { Locale } from "@/i18n/routing";
import { CREDITS, LICENCE_URLS, type Credit, type CreditGroup, type Licence } from "@/lib/credits";
import { keysOf } from "@/lib/records";
import { MAPS, mapFile, type BodyId } from "@horizon/toolkit/bodies";
import { Surface, cn, kickerClass } from "@horizon/toolkit/ui";

import { HorizonMark } from "../shell/brand";

/** Same margin column as the About letter: labels beside the content. */
const grid = "lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-14";
const linkClass =
  "rounded-sm text-fg underline decoration-accent/50 decoration-1 underline-offset-[0.22em] transition-colors hover:decoration-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const licenceClass = "font-mono text-[0.68rem] tracking-[0.14em] whitespace-nowrap uppercase";

/** Where the orrery serves its measured maps (public/textures/orrery); the globes reuse them. */
const MAP_BASE = "/textures/orrery";

/** The worlds a map credit covers, in the order the toolkit lists them: one for most, four for OPAL. */
const worldsOf = (item: Credit): BodyId[] =>
  keysOf(MAPS).filter((id) => MAPS[id]?.url === item.url);

type Translate = Awaited<ReturnType<typeof getTranslations<"credits">>>;

const count = (n: number) => String(n).padStart(2, "0");

function External({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
      <ArrowUpRight className="ml-0.5 inline size-[0.8em] align-baseline text-accent" aria-hidden />
      <span className="sr-only">({label})</span>
    </a>
  );
}

function LicenceTag({ t, licence }: { t: Translate; licence: Licence }) {
  const url = LICENCE_URLS[licence];
  const name =
    licence === "Public domain"
      ? t("licences.publicDomain")
      : licence === "Cited"
        ? t("licences.cited")
        : licence;
  return (
    <span className={cn(licenceClass, "text-subtle")}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          {name}
          <span className="sr-only"> ({t("newTab")})</span>
        </a>
      ) : (
        name
      )}
    </span>
  );
}

/** A map credit: the worlds it paints, turning on their own maps, then the source. */
function WorldCard({ t, item }: { t: Translate; item: Credit }) {
  const worlds = worldsOf(item);
  return (
    <li className="flex">
      <Surface className="flex w-full flex-col rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex -space-x-3" aria-hidden>
            {worlds.map((id) => (
              <span
                key={id}
                className="credit-globe"
                style={{ backgroundImage: `url(${mapFile(MAP_BASE, id, "far")})` }}
              />
            ))}
          </div>
          <LicenceTag t={t} licence={item.licence} />
        </div>
        <p className={cn(kickerClass, "mt-4 text-accent")}>
          {worlds.map((id) => t(`worlds.${id}`)).join(" · ")}
        </p>
        <h3 className="mt-1.5 leading-snug font-medium text-balance">
          <External href={item.url} label={t("newTab")}>
            {item.name}
          </External>
        </h3>
        <p className="mt-2 leading-relaxed text-muted">{t(`items.${item.id}`)}</p>
        <p className="mt-auto pt-4 text-[0.8125rem] leading-relaxed text-subtle">{item.by}</p>
      </Surface>
    </li>
  );
}

/** The typefaces set in themselves. */
const SPECIMENS: Record<string, ReactNode> = {
  bodoni: <span className="font-headline text-6xl leading-none">Aa</span>,
  plex: (
    <span className="flex items-baseline gap-3 leading-none">
      <span className="font-sans text-5xl">Aa</span>
      <span className="font-mono text-4xl text-muted">01</span>
    </span>
  ),
};

function FontCard({ t, item }: { t: Translate; item: Credit }) {
  return (
    <li className="flex">
      <Surface className="flex w-full flex-col rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <span className="text-fg" aria-hidden>
            {SPECIMENS[item.id]}
          </span>
          <LicenceTag t={t} licence={item.licence} />
        </div>
        <h3 className="mt-5 leading-snug font-medium text-balance">
          <External href={item.url} label={t("newTab")}>
            {item.name}
          </External>
        </h3>
        <p className="mt-2 leading-relaxed text-muted">{t(`items.${item.id}`)}</p>
        <p className="mt-auto pt-4 text-[0.8125rem] leading-relaxed text-subtle">{item.by}</p>
      </Surface>
    </li>
  );
}

/** A source in the ledger: its name and licence, then what it gave and who made it. */
function Row({ t, item }: { t: Translate; item: Credit }) {
  return (
    <li className="border-b border-border py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 font-medium">
          <External href={item.url} label={t("newTab")}>
            {item.name}
          </External>
        </p>
        <LicenceTag t={t} licence={item.licence} />
      </div>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
        {t(`items.${item.id}`)} <span className="text-subtle">· {item.by}</span>
      </p>
    </li>
  );
}

/** A package: its name and licence on one line, a line on what it does under it. */
function Tile({ t, item }: { t: Translate; item: Credit }) {
  return (
    <li className="min-w-0 border-b border-border py-3">
      <p className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium">
          <External href={item.url} label={t("newTab")}>
            {item.name}
          </External>
        </span>
        <LicenceTag t={t} licence={item.licence} />
      </p>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-subtle">
        {t(`items.${item.id}`)} · {item.by}
      </p>
    </li>
  );
}

/** How each group lays out: worlds and fonts as cards, data as a ledger, code as tiles. */
function Items({ t, group }: { t: Translate; group: CreditGroup }) {
  switch (group.id) {
    case "imagery":
      return (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {group.items.map((item) => (
            <WorldCard key={item.id} t={t} item={item} />
          ))}
        </ul>
      );
    case "fonts":
      return (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {group.items.map((item) => (
            <FontCard key={item.id} t={t} item={item} />
          ))}
        </ul>
      );
    case "data":
      return (
        <ul className="mt-3 grid border-t border-border sm:grid-cols-2 sm:gap-x-10">
          {group.items.map((item) => (
            <Row key={item.id} t={t} item={item} />
          ))}
        </ul>
      );
    default:
      return (
        <ul className="mt-3 grid border-t border-border sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {group.items.map((item) => (
            <Tile key={item.id} t={t} item={item} />
          ))}
        </ul>
      );
  }
}

/**
 * Credits and licences for everything Horizon is built on: an index, then each group laid out
 * as what it is (the worlds turning on their maps, the typefaces set in themselves, the data
 * as a ledger, the code as tiles), the notes, and the full records.
 */
export async function CreditsPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "credits" });
  return (
    <main id="main-content" tabIndex={-1} className="pb-20 outline-hidden sm:pb-28">
      <article aria-labelledby="credits-heading" className="app-container anim-rise">
        <div className="mx-auto max-w-[36rem] pt-16 text-pretty text-fg/85 sm:max-w-[42rem] sm:pt-24 lg:max-w-[60rem] lg:pt-28">
          <header className={cn(grid, "text-[1.0625rem] leading-[1.8] sm:text-lg")}>
            <p className="flex items-center gap-2.5 lg:justify-end lg:self-start lg:pt-[1.15rem]">
              <HorizonMark className="size-4 text-muted" />
              <span className={kickerClass}>{t("kicker")}</span>
            </p>
            <div>
              <h1
                id="credits-heading"
                className="mt-8 font-display text-[2.5rem] leading-[1.05] font-medium tracking-[-0.035em] text-balance text-fg sm:text-5xl lg:mt-0 lg:text-[3.5rem]"
              >
                {t.rich("title", { em: (chunks) => <span className="text-muted">{chunks}</span> })}
              </h1>
              <p className="mt-7 max-w-[34rem] text-xl leading-normal text-balance text-muted sm:text-[1.375rem]">
                {t("lead")}
              </p>
              <nav aria-label={t("contents")} className="mt-10">
                <ul className="grid grid-cols-3 border-t border-border sm:grid-cols-5">
                  {CREDITS.map((group) => (
                    <li key={group.id} className="border-b border-border">
                      <a
                        href={`#credits-${group.id}`}
                        className="group flex flex-col gap-1 rounded-sm py-3 pr-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                      >
                        <span className="font-mono text-2xl leading-none text-fg tabular-nums transition-colors group-hover:text-accent">
                          {count(group.items.length)}
                        </span>
                        <span className={cn(kickerClass, "transition-colors group-hover:text-fg")}>
                          {t(`groups.${group.id}.label`)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </header>

          {CREDITS.map((group) => (
            <section
              key={group.id}
              id={`credits-${group.id}`}
              aria-labelledby={`credits-${group.id}-title`}
              className={cn("mt-16 scroll-mt-24 text-[0.9375rem] sm:mt-20", grid)}
            >
              <div className="flex items-baseline justify-between gap-4 lg:block lg:pt-1 lg:text-right">
                <h2 id={`credits-${group.id}-title`} className={kickerClass}>
                  {t(`groups.${group.id}.label`)}
                </h2>
                <p
                  className="font-mono text-[0.75rem] text-subtle tabular-nums lg:mt-1.5"
                  aria-hidden
                >
                  {count(group.items.length)}
                </p>
              </div>
              <div className="mt-3 lg:mt-0">
                <p className="text-muted">{t(`groups.${group.id}.intro`)}</p>
                <Items t={t} group={group} />
              </div>
            </section>
          ))}

          <section
            aria-labelledby="credits-notes"
            className={cn("mt-16 text-[0.8125rem] leading-relaxed text-muted sm:mt-20", grid)}
          >
            <h2 id="credits-notes" className={cn(kickerClass, "lg:pt-5 lg:text-right")}>
              {t("notes.label")}
            </h2>
            <Surface className="mt-3 rounded-lg p-5 sm:p-6 lg:mt-0">
              <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <li>{t("notes.acknowledgement")}</li>
                <li>{t("notes.gaia")}</li>
                <li>{t("notes.simbad")}</li>
                <li>
                  {t.rich("notes.changes", {
                    link: (chunks) => (
                      <a href="#credits-map-details" className={linkClass}>
                        {chunks}
                      </a>
                    ),
                  })}
                </li>
                <li>
                  {t.rich("notes.softwareNotices", {
                    link: (chunks) => (
                      <a href="#credits-licence-texts" className={linkClass}>
                        {chunks}
                      </a>
                    ),
                  })}
                </li>
                <li>{t("notes.endorsement")}</li>
                <li>
                  {t.rich("notes.papers", {
                    link: (chunks) => (
                      <a href="#credits-source-details" className={linkClass}>
                        {chunks}
                      </a>
                    ),
                  })}
                </li>
              </ul>
            </Surface>
          </section>

          {(
            [
              ["map-details", "imagery"],
              ["source-details", "science"],
              ["licence-texts", "notices"],
            ] as const
          ).map(([id, key]) => (
            <section
              key={id}
              id={`credits-${id}`}
              aria-labelledby={`credits-${id}-heading`}
              className={cn("mt-16 scroll-mt-24 sm:mt-20", grid)}
            >
              <h2 id={`credits-${id}-heading`} className={cn(kickerClass, "lg:pt-5 lg:text-right")}>
                {t(`documents.${key}`)}
              </h2>
              <div className="mt-3 min-w-0 lg:mt-0">
                <p className="mb-5 text-sm leading-relaxed text-muted">
                  {t(`documents.${key}Intro`)}
                </p>
                <Surface className="divide-y divide-border rounded-lg">
                  {creditDocuments[key].map(({ title, text }, index) => (
                    <details key={`${title}-${index}`} className="group p-5">
                      <summary className="cursor-pointer rounded-sm text-sm font-medium text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
                        {title}
                      </summary>
                      <pre className="mt-4 font-sans text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-muted">
                        {text}
                      </pre>
                    </details>
                  ))}
                </Surface>
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
