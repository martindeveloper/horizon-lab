import { useLocale, useTranslations } from "next-intl";

import { Rail } from "@/components/simulations/rail";
import { proseArgs } from "@/lib/facts";

import { PROSE_FIGURES } from "../lib/model/catalogue";

/** The reading guide: how to read the map, one short section per idea. */
export function ReadingPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const sections = ["linear", "size", "today", "past", "ellipses", "maps"] as const;
  const figures = proseArgs(PROSE_FIGURES, useLocale());
  return (
    <Rail
      id="orrery-reading"
      title={t("guide.title")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      {sections.map((id) => (
        <section key={id}>
          <h3 className="font-display text-sm font-medium tracking-tight text-fg">
            {t(`guide.sections.${id}.title`)}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {t(`guide.sections.${id}.body`, figures)}
          </p>
        </section>
      ))}
    </Rail>
  );
}
