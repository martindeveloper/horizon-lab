import { ExternalLink } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ATLAS_CARD_SOURCES, ATLAS_SOURCES, type AtlasId } from "@/space/cosmos/model/atlas";

/** Source state comes from the pinned import manifest, not a second UI status list. */
export function AtlasProvenance({ id }: { id: AtlasId }) {
  const t = useTranslations("deepField");
  const f = useFormatter();
  return (
    <div className="border-t border-border pt-3 text-xs">
      <p className="mb-2 font-medium text-fg-primary">{t("atlas.sourcesTitle")}</p>
      <ul className="grid gap-3">
        {ATLAS_CARD_SOURCES[id].map((key) => {
          const source = ATLAS_SOURCES[key];
          return (
            <li key={key}>
              <a
                className="inline-flex items-start gap-1 text-fg-primary underline decoration-border underline-offset-4 hover:decoration-current"
                href={source.referenceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t(`atlas.sources.${key}`)}
                <ExternalLink className="mt-0.5 icon size-icon-micro" aria-hidden />
              </a>
              <p className="mt-1 text-fg-secondary">
                {t(`atlas.publication.${source.publication}`)}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-fg-secondary">
        {t("atlas.reviewed", {
          date: f.dateTime(new Date(`${ATLAS_SOURCES.cf4.reviewed}T12:00:00Z`), {
            dateStyle: "medium",
            timeZone: "UTC",
          }),
        })}
      </p>
    </div>
  );
}
