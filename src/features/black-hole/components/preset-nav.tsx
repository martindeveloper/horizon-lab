import { useTranslations } from "next-intl";
import { useState } from "react";

import { useSelectHole } from "@/features/black-hole/hooks/use-select-hole";
import { PRESETS } from "@/features/black-hole/lib/presets";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { Kicker, ListItem, Picker, cn, kickerClass } from "@horizon/toolkit/ui";

/** Preset links: a row in the header strip, or grouped lists when stacked. */
export function PresetNav({ stacked = false, onPick }: { stacked?: boolean; onPick?: () => void }) {
  const t = useTranslations("blackHole");
  const presetId = useBlackHole((s) => s.presetId);
  const selectHole = useSelectHole();
  const catalog = PRESETS.filter((p) => p.kind === "catalog");
  const theory = PRESETS.filter((p) => p.kind === "theory");
  const kind = (k: "catalog" | "theory") => (k === "catalog" ? t("kindCatalog") : t("kindTheory"));
  const nameOf = (id: string) => t(`presets.${id}`) ?? id;

  function choose(id: string) {
    selectHole(id);
    onPick?.();
  }

  function row(list: typeof PRESETS) {
    return list.map((p) =>
      stacked ? (
        <ListItem key={p.id} selected={presetId === p.id} onClick={() => choose(p.id)}>
          <span>{nameOf(p.id)}</span>
          <span className={kickerClass}>{kind(p.kind)}</span>
        </ListItem>
      ) : (
        <button
          key={p.id}
          type="button"
          aria-current={presetId === p.id ? "true" : undefined}
          onClick={() => choose(p.id)}
          className={cn(
            "h-11 shrink-0 rounded-full px-3 text-xs tracking-wide whitespace-nowrap transition-colors duration-300 md:h-8 md:px-2.5",
            presetId === p.id ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          <span>{nameOf(p.id)}</span>
          {p.kind === "catalog" ? (
            <span
              className="ml-1.5 inline-block size-1 translate-y-[-1px] rounded-full bg-accent"
              aria-hidden
            />
          ) : null}
        </button>
      ),
    );
  }

  if (stacked) {
    return (
      <nav aria-label={t("holes")} className="flex flex-col gap-4">
        <div>
          <Kicker className="mb-1.5">{t("kindCatalog")}</Kicker>
          <div className="flex flex-col gap-1">{row(catalog)}</div>
        </div>
        <div>
          <Kicker className="mb-1.5">{t("kindTheory")}</Kicker>
          <div className="flex flex-col gap-1">{row(theory)}</div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("holes")}
      className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto"
    >
      {row(catalog)}
      <span className="mx-1.5 h-3 w-px shrink-0 bg-border-strong" aria-hidden />
      {row(theory)}
    </nav>
  );
}

/** Desktop picker naming the current hole; closes when the settings panel opens. */
export function HolePicker() {
  const t = useTranslations("blackHole");
  const presetId = useBlackHole((s) => s.presetId);
  const settingsOpen = useBlackHole((s) => s.settingsOpen);
  const [open, setOpen] = useState(false);
  const active = PRESETS.find((p) => p.id === presetId);
  const name = t.has(`presets.${presetId}`) ? t(`presets.${presetId}`) : t("custom");
  const kind = active?.kind === "theory" ? t("kindTheory") : t("kindCatalog");

  const [previousSettingsOpen, setPreviousSettingsOpen] = useState(settingsOpen);
  if (previousSettingsOpen !== settingsOpen) {
    setPreviousSettingsOpen(settingsOpen);
    if (settingsOpen) setOpen(false);
  }

  return (
    <Picker
      className="hidden md:block"
      label={name}
      detail={kind}
      aria-label={t("holes")}
      open={open}
      onOpenChange={setOpen}
    >
      <PresetNav stacked onPick={() => setOpen(false)} />
    </Picker>
  );
}
