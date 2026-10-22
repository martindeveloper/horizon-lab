import type { Translate } from "@/lib/facts";
import { SOURCES, type Source } from "@/lib/sources";

import type { RungId } from "../lib/model/rungs";
import { cardSources } from "./card-specs";

/** Keep provenance in the card's existing scroll area, within an optional disclosure. */
export function CardSources({ id, t }: { id: RungId; t: Translate }) {
  return (
    <details className="text-ui leading-relaxed text-fg-secondary">
      <summary className="min-h-11 cursor-pointer rounded-compact ui-press py-3 ui-focus transition-colors duration-feedback ease-standard">
        {t("card.sources")}
      </summary>
      <p className="mt-1">{t("card.ranges")}</p>
      <p className="mt-2">{t("card.comparison")}</p>
      <dl className="mt-3 space-y-3">
        {cardSources(id).map((row) => (
          <div key={row.id}>
            <dt className="text-fg-primary">
              {t(`facts.${row.id}`)} · {t(`card.status.${row.status}`)}
            </dt>
            {row.sources.map((key) => {
              const source: Source = SOURCES[key];
              return (
                <dd key={key}>
                  {source.link ? (
                    <a
                      className="rounded-compact ui-quiet underline underline-offset-2 ui-focus transition-colors duration-feedback ease-standard"
                      href={source.link}
                    >
                      {source.cite}
                    </a>
                  ) : (
                    source.cite
                  )}
                </dd>
              );
            })}
          </div>
        ))}
      </dl>
    </details>
  );
}
