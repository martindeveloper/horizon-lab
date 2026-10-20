"use client";

import { GraduationCap, Info, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useRef, type ReactNode, type Ref } from "react";

import { IconButton, Toolbar, Tooltip, type DialogHandle } from "@horizon/toolkit/ui";

import { SimulationExperience } from "./immersive";
import { SceneMoreMenu, type MoreItem } from "./more-menu";
import type { TechnicalDetailsAccess } from "./technical-details";

/** A toolbar button that opens something: a panel (`controls` names it), an overlay, a dialog. */
type SimulationTool = {
  /** Also `data-return`, so what it opens can hand focus back. */
  id: string;
  label: string;
  /** The accessible name, when it says more than the tooltip. */
  ariaLabel?: string;
  /** Its row in the phone's More menu, when `label` names what a click does now ("Close"). */
  menuLabel?: string;
  icon: LucideIcon;
  active?: boolean;
  /** The id of the panel it discloses while open. */
  controls?: string;
  onSelect: () => void;
};

const iconClass = "size-4 md:size-3.5";

function ToolButton({
  tool,
  ref,
}: {
  tool: SimulationTool;
  ref?: Ref<HTMLButtonElement> | undefined;
}) {
  const { id, label, ariaLabel, icon: Icon, active, controls, onSelect } = tool;
  return (
    <Tooltip label={label}>
      <IconButton
        ref={ref}
        data-return={id}
        aria-label={ariaLabel ?? label}
        {...(controls !== undefined
          ? { "aria-expanded": !!active, "aria-controls": active ? controls : undefined }
          : {})}
        active={!!active}
        onClick={onSelect}
      >
        <Icon className={iconClass} />
      </IconButton>
    </Tooltip>
  );
}

/**
 * Every simulation's header tools, in one order so hands learn it once: technical details,
 * the guide, the finder (what to look at), the simulation's other tools, its settings panel,
 * then the experiences (immersive view and, with `drift`, the drift). Phones keep the guide,
 * the finder, the settings and the experiences, and fold the rest into More, in the same order.
 */
export function SimulationToolbar({
  label,
  details,
  detailsLabel,
  guide,
  guideRef,
  finder,
  tools = [],
  settings,
  drift,
}: {
  label: string;
  /** The feature's technical details, given the handle and trigger class the toolbar needs. */
  details: (access: TechnicalDetailsAccess) => ReactNode;
  /** Its name in the phone's More menu. */
  detailsLabel: string;
  guide: Omit<SimulationTool, "id" | "icon">;
  /** The guide button, for focus to return to when the guide ends. */
  guideRef?: Ref<HTMLButtonElement>;
  finder?: SimulationTool;
  tools?: readonly SimulationTool[];
  settings: Omit<SimulationTool, "id" | "icon">;
  /** Starts the simulation's drift (`src/lib/drift.ts`); without it the experiences button enters immersive view. */
  drift?: () => void;
}) {
  const dialog = useRef<DialogHandle>(null);
  const more: MoreItem[] = [
    {
      id: "details",
      label: detailsLabel,
      icon: Info,
      onSelect: () => dialog.current?.open(),
    },
    ...tools.map(({ id, label: name, menuLabel, icon, active, onSelect }) => ({
      id,
      label: menuLabel ?? name,
      icon,
      onSelect,
      ...(active !== undefined ? { active } : {}),
    })),
  ];
  return (
    <Toolbar aria-label={label} className="ml-auto shrink-0">
      {details({ ref: dialog, triggerClassName: "not-md:hidden" })}
      <ToolButton ref={guideRef} tool={{ ...guide, id: "guide", icon: GraduationCap }} />
      {finder ? <ToolButton tool={finder} /> : null}
      <div className="not-md:hidden md:contents">
        {tools.map((tool) => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>
      <ToolButton tool={{ ...settings, id: "settings", icon: SlidersHorizontal }} />
      <SimulationExperience onDrift={drift} />
      <SceneMoreMenu className="md:hidden" items={more} />
    </Toolbar>
  );
}
