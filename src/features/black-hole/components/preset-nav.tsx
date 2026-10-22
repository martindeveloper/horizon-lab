import { useTranslations } from "next-intl";
import { useState } from "react";

import { ViewList, ViewPickerShell } from "@/components/simulations/view-picker";
import { usePhysicsFormat } from "@/features/black-hole/hooks/use-physics-format";
import { useSelectHole } from "@/features/black-hole/hooks/use-select-hole";
import { PRESETS, type HoleKind, type HoleSpec } from "@/features/black-hole/lib/holes";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { Orb } from "@horizon/toolkit/ui";

const KINDS: readonly HoleKind[] = ["catalog", "theory"];

const LOG_MASS = PRESETS.map((p) => Math.log10(p.massSolar));
const LOG_LOW = Math.min(...LOG_MASS);
const LOG_HIGH = Math.max(...LOG_MASS);
/** A mark's diameter, px, from the lightest preset's to the heaviest's. */
const HOLE_PX = [5, 16] as const;

/** A hole's mark: a horizon as large as its mass, on a log scale across the presets. */
function HoleOrb({ massSolar }: { massSolar: number }) {
  const share = (Math.log10(massSolar) - LOG_LOW) / (LOG_HIGH - LOG_LOW);
  const clamped = Math.min(1, Math.max(0, share));
  return <Orb look="hole" size={HOLE_PX[0] + clamped * (HOLE_PX[1] - HOLE_PX[0])} />;
}

type Measure = Pick<HoleSpec, "kind" | "massSolar" | "spin" | "massLowerLimit">;

/** What sets a hole apart in the list: a catalogued one's mass, a theory's spin. */
function useMeasure() {
  const { formatMassShort, formatSpin } = usePhysicsFormat();
  return ({ kind, massSolar, spin, massLowerLimit }: Measure) =>
    kind === "theory"
      ? `a = ${formatSpin(spin)}`
      : `${massLowerLimit ? "≥ " : ""}${formatMassShort(massSolar)}`;
}

/**
 * The holes by kind, in the shared view pill: catalogued holes, then theory, each marked by its
 * mass and measured by what sets it apart. Closes when the settings panel opens.
 */
export function HolePicker() {
  const t = useTranslations("blackHole");
  const presetId = useBlackHole((s) => s.presetId);
  const massSolar = useBlackHole((s) => s.massSolar);
  const spin = useBlackHole((s) => s.spin);
  const settingsOpen = useBlackHole((s) => s.settingsOpen);
  const selectHole = useSelectHole();
  const measure = useMeasure();
  const [open, setOpen] = useState(false);
  const active = PRESETS.find((p) => p.id === presetId);
  const name = t.has(`presets.${presetId}`) ? t(`presets.${presetId}`) : t("custom");
  const byId = (id: string) => PRESETS.find((p) => p.id === id)!;

  const [previousSettingsOpen, setPreviousSettingsOpen] = useState(settingsOpen);
  if (previousSettingsOpen !== settingsOpen) {
    setPreviousSettingsOpen(settingsOpen);
    if (settingsOpen) setOpen(false);
  }

  return (
    <ViewPickerShell
      ariaLabel={t("holes")}
      label={name}
      icon={<HoleOrb massSolar={massSolar} />}
      detail={measure({
        kind: active?.kind ?? "catalog",
        massSolar,
        spin,
        ...(active?.massLowerLimit ? { massLowerLimit: true } : {}),
      })}
      open={open}
      onOpenChange={setOpen}
    >
      <nav aria-label={t("holes")} className="flex flex-col gap-2">
        {KINDS.map((kind) => (
          <ViewList
            key={kind}
            title={kind === "catalog" ? t("kindCatalog") : t("kindTheory")}
            ids={PRESETS.filter((p) => p.kind === kind).map((p) => p.id)}
            selected={(id) => presetId === id}
            labelOf={(id) => t(`presets.${id}`)}
            iconOf={(id) => <HoleOrb massSolar={byId(id).massSolar} />}
            detailOf={(id) => measure(byId(id))}
            onPick={(id) => {
              setOpen(false);
              selectHole(id);
            }}
          />
        ))}
      </nav>
    </ViewPickerShell>
  );
}
