import { CalendarClock } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useMemo } from "react";

import { GLYPH_ICON } from "@/components/simulations/body-orb";
import { Rail, RailSection } from "@/components/simulations/rail";
import { solarNameKey } from "@/space/solar-system/format";
import { ListItem } from "@horizon/toolkit/ui";

import { solarEvents, type SolarEvent } from "../lib/model/events";
import { MOMENTS } from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";

type Translate = ReturnType<typeof useTranslations<"orrery">>;

/** The moments around today, found once a day. */
export function useMoments(now: Date) {
  const [year, month, dayOfMonth] = [now.getFullYear(), now.getMonth(), now.getDate()];
  return useMemo(() => solarEvents(new Date(year, month, dayOfMonth)), [year, month, dayOfMonth]);
}

/** "Mars at opposition": the moment in words, its bodies by the shared names. */
export function momentTitle(t: Translate, event: SolarEvent) {
  const [first, second] = event.bodies;
  return t(`events.${event.kind}`, {
    name: first ? t(solarNameKey(first)) : "",
    other: second ? t(solarNameKey(second)) : "",
  });
}

/**
 * The clock's moments: picking one sets the Motion clock to its date, flies to the scale that
 * shows it and opens the body's card; Today brings the clock back. The milestones of deep time
 * set the slider instead.
 */
export function MomentsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });
  const events = useMoments(now);
  const date = (value: Date) => f.dateTime(value, { dateStyle: "medium" });
  const pickEvent = (event: SolarEvent) => {
    const api = useOrrery.getState();
    api.setClock(event.years);
    api.setView(event.view);
    /* A comet shows only on its ellipse. */
    if (event.bodies.some((b) => b.kind === "named" && b.id === "halley"))
      api.patchShow({ elliptical: true });
    api.select(event.bodies[0] ?? null);
    api.setPanel("none");
  };
  return (
    <Rail
      id="orrery-moments"
      title={t("hud.moments")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("hud.momentsClock")} count={events.length}>
        <div className="-mx-3 grid gap-0.5">
          <ListItem
            icon={<CalendarClock aria-hidden className={GLYPH_ICON} />}
            detail={date(now)}
            onClick={() => {
              const api = useOrrery.getState();
              api.setClock(0);
              api.setPanel("none");
            }}
          >
            {t("time.today")}
          </ListItem>
          {events.map((event) => (
            <ListItem
              key={event.id}
              icon={<CalendarClock aria-hidden className={GLYPH_ICON} />}
              detail={date(event.date)}
              onClick={() => pickEvent(event)}
            >
              {momentTitle(t, event)}
            </ListItem>
          ))}
        </div>
        <p className="mt-2 text-ui text-fg-tertiary">{t("hud.momentsNote")}</p>
      </RailSection>
      <RailSection title={t("hud.momentsDeep")} count={MOMENTS.length}>
        <div className="-mx-3 grid gap-0.5">
          {[...MOMENTS].reverse().map((moment) => (
            <ListItem
              key={moment.id}
              icon={<CalendarClock aria-hidden className={GLYPH_ICON} />}
              detail={formatYearsAgo(t, f, moment.yearsAgo, locale)}
              onClick={() => {
                const api = useOrrery.getState();
                api.setYearsAgo(moment.yearsAgo);
                api.setPanel("none");
              }}
            >
              {t(`moments.${moment.id}`)}
            </ListItem>
          ))}
        </div>
      </RailSection>
    </Rail>
  );
}
