import { useTranslations } from "next-intl";

import { Rail } from "@/components/simulations/rail";

/** The reading guide: how to read the map, one short section per idea. */
export function ReadingPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const sections = ["linear", "size", "today", "past", "ellipses", "maps"] as const;
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
            {t(`guide.sections.${id}.body`)}
          </p>
        </section>
      ))}
    </Rail>
  );
}
