import { getFormatter, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { readChangelog, type ChangelogInline } from "@/lib/changelog";
import { ANCHOR_IDS } from "@/lib/urls";

import { LetterHeader, LetterPart, letterEmphasis } from "./letter";

function Inline({ inline }: { inline: ChangelogInline[] }) {
  return inline.map(({ kind, text }, index) => {
    switch (kind) {
      case "strong":
        return (
          <strong key={index} className="font-medium text-fg-primary">
            {text}
          </strong>
        );
      case "code":
        return (
          <code key={index} className="font-mono text-[0.9em] text-fg-primary">
            {text}
          </code>
        );
      default:
        return text;
    }
  });
}

export async function ChangelogPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "changelog" });
  const format = await getFormatter({ locale });
  return (
    <main id={ANCHOR_IDS.mainContent} tabIndex={-1} className="pb-20 outline-hidden sm:pb-28">
      <article aria-labelledby="changelog-heading" className="app-container anim-rise">
        <div className="mx-auto max-w-[36rem] pt-16 leading-[1.7] text-pretty text-fg-primary/85 sm:pt-24 lg:max-w-[51rem] lg:pt-28">
          <LetterHeader
            id="changelog-heading"
            className="text-[1.0625rem] leading-[1.8] sm:text-lg"
            kicker={t("kicker")}
            title={t.rich("title", { em: letterEmphasis })}
            lead={t("lead")}
          />

          {readChangelog(locale).map(({ date, groups }) => (
            <LetterPart
              key={date}
              id={`changelog-${date}`}
              label={
                <time dateTime={date}>
                  {format.dateTime(new Date(date), { dateStyle: "long", timeZone: "UTC" })}
                </time>
              }
            >
              {groups.map(({ heading, items }) => (
                <section key={heading}>
                  <h3 className="text-[1.0625rem] font-medium text-fg-primary">{heading}</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-accent/70">
                    {items.map(({ text, details }, index) => (
                      <li key={index}>
                        <Inline inline={text} />
                        {details.length > 0 ? (
                          <ul className="mt-1.5 list-[circle] space-y-1 pl-5 text-fg-secondary marker:text-fg-tertiary">
                            {details.map((detail, at) => (
                              <li key={at}>
                                <Inline inline={detail} />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </LetterPart>
          ))}
        </div>
      </article>
    </main>
  );
}
