"use client";

import {
  CircleQuestionMark,
  GraduationCap,
  Info,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ReactNode, type Ref } from "react";

import { COACH_OPENER, IconButton, Toolbar, Tooltip, type DialogHandle } from "@horizon/toolkit/ui";

import { HelpTour, type HelpAccess } from "./help-tour";
import { SimulationExperience } from "./immersive";
import { SceneMoreMenu, type MoreItem } from "./more-menu";
import type { TechnicalDetailsAccess } from "./technical-details";

/** A toolbar button that opens something: a panel (`controls` names it), an overlay, a dialog. */
type SimulationTool = {
  /** Also `data-return`, so what it opens can hand focus back, and `data-coach`, so a tour can ring it. */
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
  opener = false,
}: {
  tool: SimulationTool;
  ref?: Ref<HTMLButtonElement> | undefined;
  /** It opens the tour, so a press on it is not a press outside the tour. */
  opener?: boolean;
}) {
  const { id, label, ariaLabel, icon: Icon, active, controls, onSelect } = tool;
  return (
    <Tooltip label={label}>
      <IconButton
        ref={ref}
        data-return={id}
        data-coach={id}
        {...(opener ? { [COACH_OPENER]: "" } : {})}
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
 * Every simulation's header tools, in one order so hands learn it once: help (the `?` tour of
 * these controls), technical details, the guide, the finder (what to look at), the simulation's
 * other tools, its settings panel, then the experiences (immersive view and, with `drift`, the
 * drift). Phones keep help, the guide, the finder, the settings and the experiences, and fold
 * the rest into More, in the same order. The experiences and More carry `data-coach` too.
 */
export function SimulationToolbar({
  label,
  help,
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
  /** The simulation's `?` tour (`useHelp`); its wording is the shared `help` copy. */
  help: HelpAccess;
  /** The feature's technical details, given the handle and trigger class the toolbar needs. */
  details: (access: TechnicalDetailsAccess) => ReactNode;
  /** Its name in the phone's More menu. */
  detailsLabel: string;
  /** The guide button; its wording is the shared `guide` copy. */
  guide: Omit<SimulationTool, "id" | "icon" | "label" | "ariaLabel">;
  /** The guide button, for focus to return to when the guide ends. */
  guideRef?: Ref<HTMLButtonElement>;
  finder?: SimulationTool;
  tools?: readonly SimulationTool[];
  settings: Omit<SimulationTool, "id" | "icon">;
  /** Starts the simulation's drift (`src/lib/drift.ts`); without it the experiences button enters immersive view. */
  drift?: () => void;
}) {
  const dialog = useRef<DialogHandle>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const tGuide = useTranslations("guide");
  const tHelp = useTranslations("help");
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
      <ToolButton
        ref={helpButton}
        opener
        tool={{
          id: "help",
          icon: CircleQuestionMark,
          label: tHelp("title"),
          ariaLabel: help.open ? tHelp("close") : tHelp("start"),
          active: help.open,
          onSelect: help.open ? help.end : help.start,
        }}
      />
      {help.open ? <HelpTour help={help} returnFocus={() => helpButton.current} /> : null}
      {details({ ref: dialog, triggerClassName: "not-md:hidden" })}
      <ToolButton
        ref={guideRef}
        tool={{
          ...guide,
          id: "guide",
          icon: GraduationCap,
          label: tGuide("title"),
          ariaLabel: tGuide("start"),
        }}
      />
      {finder ? <ToolButton tool={finder} /> : null}
      <div className="not-md:hidden md:contents">
        {tools.map((tool) => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>
      <ToolButton tool={{ ...settings, id: "settings", icon: SlidersHorizontal }} />
      <span data-coach="experiences" className="inline-flex">
        <SimulationExperience onDrift={drift} />
      </span>
      <span data-coach="more" className="inline-flex md:hidden">
        <SceneMoreMenu items={more} />
      </span>
    </Toolbar>
  );
}
