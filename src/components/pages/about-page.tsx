import { getTranslations } from "next-intl/server";

import { REPOSITORY_URL } from "@/config";
import type { Locale } from "@/i18n/routing";
import { ANCHOR_IDS, EXTERNAL_URLS } from "@/lib/urls";
import { cn } from "@horizon/toolkit/ui";

import { ExternalLink, LetterHeader, LetterPart, letterEmphasis, letterGrid } from "./letter";

const COURSE_URL = EXTERNAL_URLS.astronomyCourse;

const thanks = [
  { name: "Planetum", role: "organiser" },
  { name: "Jakub Rozehnal", role: "teacher" },
  { name: "Petr Kulhánek", role: "teacher" },
] as const;

const caveats = ["simplified", "approximate", "performance"] as const;

const linkClass =
  "ui-focus font-medium text-fg-primary underline decoration-accent/60 decoration-1 underline-offset-[0.22em] transition-colors duration-feedback ease-standard hover:decoration-accent focus-visible:rounded-compact";

export async function AboutPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "about" });
  return (
    <main id={ANCHOR_IDS.mainContent} tabIndex={-1} className="pb-20 outline-hidden sm:pb-28">
      <article aria-labelledby="about-heading" className="app-container anim-rise">
        <div className="mx-auto max-w-[36rem] pt-16 text-[1.0625rem] leading-[1.8] text-pretty text-fg-primary/85 sm:pt-24 sm:text-lg lg:max-w-[51rem] lg:pt-28 lg:text-[1.1875rem] lg:leading-[1.75]">
          <LetterHeader
            id="about-heading"
            kicker={t("kicker")}
            title={t.rich("title", { em: letterEmphasis })}
            lead={t("lead")}
          >
            <span className="mt-10 block h-px w-12 bg-accent/60" aria-hidden />
            <figure className="mt-10 max-w-[25rem] sm:ml-auto">
              <blockquote className="text-[0.95em] leading-relaxed text-fg-secondary italic">
                {locale === "cs" ? `„${t("quote.text")}“` : `“${t("quote.text")}”`}
              </blockquote>
              <figcaption className="mt-3 text-[0.8em] text-fg-tertiary">
                — {t("quote.source")}
              </figcaption>
            </figure>
          </LetterHeader>

          <LetterPart id="about-course" label={t("course.label")}>
            <p>
              {t.rich("course.body", {
                link: (chunks) => (
                  <ExternalLink href={COURSE_URL} newTab={t("newTab")} className={linkClass}>
                    {chunks}
                  </ExternalLink>
                ),
              })}
            </p>
            <p>{t("course.next")}</p>
          </LetterPart>

          <LetterPart id="about-disclaimer" label={t("disclaimer.label")}>
            <p>{t("disclaimer.body")}</p>
            <dl className="grid gap-y-3 border-y border-border py-5 text-[0.9em] leading-relaxed sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-8">
              {caveats.map((key) => (
                <div key={key} className="contents">
                  <dt className="font-medium whitespace-nowrap text-fg-primary">
                    {t(`disclaimer.${key}`)}
                  </dt>
                  <dd className="-mt-2 text-fg-secondary sm:mt-0">{t(`disclaimer.${key}Body`)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-fg-primary">{t("disclaimer.sources")}</p>
          </LetterPart>

          <LetterPart id="about-source" label={t("source.label")}>
            <p>
              {t.rich("source.body", {
                link: (chunks) => (
                  <ExternalLink href={REPOSITORY_URL} newTab={t("newTab")} className={linkClass}>
                    {chunks}
                  </ExternalLink>
                ),
              })}
            </p>
          </LetterPart>

          <LetterPart id="about-thanks" label={t("thanks.label")}>
            <p>{t("thanks.body")}</p>
            <ul className="space-y-1.5">
              {[
                ...thanks.map(({ name, role }) => [name, t(`thanks.${role}`)] as const),
                [t("thanks.team"), t("thanks.teamRole")] as const,
              ].map(([name, role]) => (
                <li key={name}>
                  <span className="text-fg-primary">{name}</span>
                  <span className="text-fg-tertiary">, {role.toLocaleLowerCase(locale)}</span>
                </li>
              ))}
            </ul>
          </LetterPart>

          <section aria-labelledby="about-author" className={cn("mt-20 sm:mt-24", letterGrid)}>
            <h2 id="about-author" className="sr-only">
              {t("author.label")}
            </h2>
            <div className="lg:col-start-2">
              <p>{t("signoff")}</p>
              <p className="mt-4 font-headline text-[2.25rem] leading-none text-fg-primary italic">
                Martin Pernica
              </p>
              <p className="mt-3 text-[0.9em] text-fg-secondary">{t("author.role")}</p>
            </div>
          </section>

          <LetterPart
            id="about-ai"
            label={t("author.aiLabel")}
            className="border-t border-border pt-8 text-[0.85em] leading-relaxed text-fg-secondary"
          >
            <p>{t("author.ai")}</p>
          </LetterPart>
        </div>
      </article>
    </main>
  );
}
