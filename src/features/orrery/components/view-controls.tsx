import { useTranslations } from "next-intl";
import { useState } from "react";

import { Chip, ListItem, Picker, cn } from "@horizon/toolkit/ui";

import { VIEWS } from "../lib/model/views";
import { useOrrery, type Show } from "../lib/store";

export const DISPLAY: (keyof Show)[] = ["elliptical", "trueSize", "drift", "names", "distances"];
export const EXTRA: (keyof Show)[] = ["plane", "halo"];

export function ViewPicker() {
  const t = useTranslations("orrery");
  const view = useOrrery((s) => s.view);
  const setView = useOrrery((s) => s.setView);
  const [open, setOpen] = useState(false);
  return (
    <Picker
      label={t(`views.${view}`)}
      aria-label={t("hud.views")}
      open={open}
      onOpenChange={setOpen}
      triggerClassName="relative max-w-[min(16rem,100%)] not-md:h-10 not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-0.5"
    >
      <div className="flex flex-col gap-1">
        {VIEWS.map((v) => (
          <ListItem
            key={v.id}
            selected={view === v.id}
            onClick={() => {
              setView(v.id);
              setOpen(false);
            }}
            className="flex-col items-start justify-start gap-0"
          >
            <span>{t(`views.${v.id}`)}</span>
            <span className="text-xs text-muted">{t(`viewHints.${v.id}`)}</span>
          </ListItem>
        ))}
      </div>
    </Picker>
  );
}

export function Switches({ keys }: { keys: (keyof Show)[] }) {
  const t = useTranslations("orrery");
  const show = useOrrery((s) => s.show);
  const patchShow = useOrrery((s) => s.patchShow);
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => (
        <Chip
          key={key}
          role="switch"
          aria-checked={show[key]}
          selected={show[key]}
          onClick={() => patchShow({ [key]: !show[key] })}
          className="gap-1.5"
        >
          {/* A gold pip for on, an empty ring for off: the state reads without the glass. */}
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full transition-colors duration-300",
              show[key] ? "bg-accent" : "border border-current opacity-60",
            )}
          />
          {t(`toggles.${key}`)}
        </Chip>
      ))}
    </div>
  );
}
