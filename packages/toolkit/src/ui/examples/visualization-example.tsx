"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";

import {
  ControlRow,
  DataReadout,
  IconButton,
  SegmentedControl,
  Slider,
  Surface,
  Toolbar,
  Tooltip,
  VisualizationOverlay,
  VisualizationShell,
} from "../index";

/** Integration template, deliberately not mounted in any application route. */
export function VisualizationExample() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<"draft" | "detail">("detail");

  return (
    <VisualizationShell aria-label="Visualization example">
      {/* Replace this layer with your canvas, SVG, or scene component. */}
      <div className="absolute inset-0 bg-surface-primary" />
      <VisualizationOverlay>
        <header className="hud-top pad-hud-top absolute inset-x-0 top-0 flex items-center gap-3">
          <h1 className="hud-title font-display text-section">New visualization</h1>
          <Toolbar aria-label="Playback" className="ml-auto">
            <Tooltip label={running ? "Pause" : "Play"}>
              <IconButton
                aria-label={running ? "Pause simulation" : "Resume simulation"}
                aria-pressed={running}
                active={running}
                onClick={() => setRunning(!running)}
              >
                {running ? <Pause className="size-4" /> : <Play className="size-4" />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </header>
        <section
          aria-label="Simulation controls"
          className="pad-hud-bottom absolute inset-x-0 bottom-0 md:inset-x-auto md:right-0 md:w-80"
        >
          <Surface className="pointer-events-auto space-y-section rounded-panel p-panel">
            <ControlRow label="Speed" value={`${speed.toFixed(1)}×`}>
              <Slider
                aria-label="Simulation speed"
                min={0.1}
                max={3}
                step={0.1}
                value={[speed]}
                onValueChange={([value]) => setSpeed(value ?? 1)}
              />
            </ControlRow>
            <SegmentedControl
              aria-label="Render quality"
              value={quality}
              onValueChange={setQuality}
              options={[
                { value: "draft", label: "Draft" },
                { value: "detail", label: "Detail" },
              ]}
            />
            <DataReadout
              className="grid-cols-2"
              items={[
                { id: "speed", label: "Speed", value: `${speed.toFixed(1)}×` },
                {
                  id: "state",
                  label: "State",
                  value: running ? "Running" : "Paused",
                },
              ]}
            />
          </Surface>
        </section>
      </VisualizationOverlay>
    </VisualizationShell>
  );
}
