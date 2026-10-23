"use client";

import {
  CircleQuestionMark,
  GraduationCap,
  Maximize2,
  Orbit,
  Sigma,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ReactNode, type Ref } from "react";

import {
  COACH_OPENER,
  IconButton,
  Toolbar,
  Tooltip,
  setImmersive,
  type DialogHandle,
} from "@horizon/toolkit/ui";

import { HelpTour, type HelpAccess } from "./help-tour";
import { SimulationExperience } from "./immersive";
import { SceneMoreMenu, type MoreItem } from "./more-menu";
import type { TechnicalDetailsAccess } from "./technical-details";
import { toolsShown, useToolbarSlots } from "./toolbar-fold";

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

function ToolButton({
  tool,
  ref,
  opener = false,
  align,
}: {
  tool: SimulationTool;
  ref?: Ref<HTMLButtonElement> | undefined;
  /** It opens the tour, so a press on it is not a press outside the tour. */
  opener?: boolean;
  /** `end` for the toolbar's last button, so its tip stays on screen. */
  align?: "end";
}) {
  const { id, label, ariaLabel, icon: Icon, active, controls, onSelect } = tool;
  return (
    <Tooltip label={label} {...(align ? { align } : {})}>
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
        <Icon className="icon-toolbar" />
      </IconButton>
    </Tooltip>
  );
}

/** A tool as its row in the More menu. */
const rowOf = ({ id, label, menuLabel, icon, active, onSelect }: SimulationTool): MoreItem => ({
  id,
  label: menuLabel ?? label,
  icon,
  onSelect,
  ...(active !== undefined ? { active } : {}),
});

/** A place on the toolbar: its coach id and its role in folding. */
type Place = { id: string; role: (typeof KEPT_LONGEST)[number] };

/** The places' roles, from the one that stays out of More longest to the first to fold. */
const KEPT_LONGEST = [
  "finder",
  "guide",
  "settings",
  "experiences",
  "help",
  "details",
  "tool",
] as const;

/**
 * Every simulation's header tools, in one order so hands learn it once, from what is most the
 * simulation's own to what every scene shares: its own tools, the finder (what to look at), the
 * guide, its settings panel, technical details, the experiences (immersive view and, with
 * `drift`, the drift), then help (the `?` tour of these controls). The toolbar shows as many as
 * its line has room for beside the row's other items, keeping the finder, the guide, the
 * settings, the experiences and help longest, and folds the rest into More, in the same order;
 * a folded tool's coach id rings More. Every button carries `data-coach` with its id; the
 * experiences and More do too. The row it stands in must not wrap (`HeaderRow`).
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
  /** Its name in the More menu. */
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
  const bar = useRef<HTMLDivElement>(null);
  const dialog = useRef<DialogHandle>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const tGuide = useTranslations("guide");
  const tHelp = useTranslations("help");
  const tImmersive = useTranslations("immersive");
  const tDrift = useTranslations("drift");
  const slots = useToolbarSlots(bar);

  const guideTool: SimulationTool = {
    ...guide,
    id: "guide",
    icon: GraduationCap,
    label: tGuide("title"),
    ariaLabel: tGuide("start"),
  };
  const settingsTool: SimulationTool = { ...settings, id: "settings", icon: SlidersHorizontal };
  const detailsTool: SimulationTool = {
    id: "details",
    label: detailsLabel,
    icon: Sigma,
    onSelect: () => dialog.current?.open(),
  };
  const helpTool: SimulationTool = {
    id: "help",
    icon: CircleQuestionMark,
    label: tHelp("title"),
    ariaLabel: help.open ? tHelp("close") : tHelp("start"),
    menuLabel: help.open ? tHelp("close") : tHelp("title"),
    active: help.open,
    onSelect: help.open ? help.end : help.start,
  };

  /* The places in toolbar order; those the line has no room for fold into More. */
  const places: readonly Place[] = [
    ...tools.map(({ id }) => ({ id, role: "tool" as const })),
    ...(finder ? [{ id: finder.id, role: "finder" as const }] : []),
    { id: "guide", role: "guide" },
    { id: "settings", role: "settings" },
    { id: "details", role: "details" },
    { id: "experiences", role: "experiences" },
    { id: "help", role: "help" },
  ];
  const kept = new Set(
    [...places]
      .sort((a, b) => KEPT_LONGEST.indexOf(a.role) - KEPT_LONGEST.indexOf(b.role))
      .slice(0, toolsShown(places.length, slots))
      .map(({ id }) => id),
  );
  const folded = places.filter(({ id }) => !kept.has(id)).map(({ id }) => id);
  const fold = (tool: SimulationTool) => (kept.has(tool.id) ? [] : [rowOf(tool)]);
  const rows: MoreItem[] = [
    ...tools.flatMap(fold),
    ...(finder ? fold(finder) : []),
    ...fold(guideTool),
    ...fold(settingsTool),
    ...(kept.has("details") ? [] : [detailsTool]),
    ...(kept.has("experiences")
      ? []
      : [
          {
            id: "immersive",
            label: tImmersive("title"),
            icon: Maximize2,
            onSelect: () => setImmersive(true),
          },
          ...(drift
            ? [
                {
                  id: "drift",
                  label: tDrift("title"),
                  icon: Orbit,
                  onSelect: () => {
                    setImmersive(true);
                    drift();
                  },
                },
              ]
            : []),
        ]),
    ...fold(helpTool),
  ];
  return (
    <Toolbar ref={bar} aria-label={label} className="ml-auto shrink-0">
      {/* The dialog only; the toolbar draws its button with the others. */}
      {details({ ref: dialog, triggerClassName: "hidden" })}
      {tools.map((tool) => (kept.has(tool.id) ? <ToolButton key={tool.id} tool={tool} /> : null))}
      {finder && kept.has(finder.id) ? <ToolButton tool={finder} /> : null}
      {kept.has("guide") ? <ToolButton ref={guideRef} tool={guideTool} /> : null}
      {kept.has("settings") ? <ToolButton tool={settingsTool} /> : null}
      {kept.has("details") ? <ToolButton tool={detailsTool} /> : null}
      {kept.has("experiences") ? (
        <span data-coach="experiences" className="inline-flex">
          <SimulationExperience onDrift={drift} />
        </span>
      ) : null}
      {kept.has("help") ? <ToolButton ref={helpButton} opener align="end" tool={helpTool} /> : null}
      {help.open ? <HelpTour help={help} returnFocus={() => helpButton.current} /> : null}
      {folded.length ? (
        /* More stands in for each tool it holds, so a tour step on one rings it. */
        <span data-coach="more" className="inline-flex">
          {folded.reduceRight<ReactNode>(
            (inner, id) => (
              <span data-coach={id} className="inline-flex">
                {inner}
              </span>
            ),
            <SceneMoreMenu items={rows} />,
          )}
        </span>
      ) : null}
    </Toolbar>
  );
}
