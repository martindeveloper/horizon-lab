"use client";

import { Crosshair, SlidersHorizontal } from "lucide-react";

import { IconButton, Tooltip } from "@horizon/toolkit/ui";

/** The Objects and View disclosures shared by the space simulations. */
export function ScenePanelButtons({
  simulationId,
  panel,
  objectsLabel,
  viewLabel,
  onPanelChange,
}: {
  simulationId: string;
  panel: string;
  objectsLabel: string;
  viewLabel: string;
  onPanelChange: (panel: "none" | "objects" | "view") => void;
}) {
  const buttons = [
    { id: "objects", label: objectsLabel, Icon: Crosshair },
    { id: "view", label: viewLabel, Icon: SlidersHorizontal },
  ] as const;

  return buttons.map(({ id, label, Icon }) => {
    const active = panel === id;
    return (
      <Tooltip key={id} label={label}>
        <IconButton
          aria-label={label}
          aria-expanded={active}
          aria-controls={active ? `${simulationId}-${id}` : undefined}
          active={active}
          onClick={() => onPanelChange(active ? "none" : id)}
        >
          <Icon className="size-4 md:size-3.5" />
        </IconButton>
      </Tooltip>
    );
  });
}
