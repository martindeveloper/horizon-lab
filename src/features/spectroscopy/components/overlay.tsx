"use client";

import { Atom, GraduationCap, Info, Maximize2, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { SimulationImmersiveToggle } from "@/components/simulations/immersive";
import { SceneMoreMenu } from "@/components/simulations/more-menu";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  IconButton,
  ListItem,
  Picker,
  Toolbar,
  Tooltip,
  VisualizationOverlay,
  cn,
  kickerClass,
  setImmersive,
  type DialogHandle,
} from "@horizon/toolkit/ui";

import { VIEW_IDS, type ViewId } from "../lib/model/view-ids";
import { useSpectroscopy, type Panel } from "../lib/store";
import { pathForView } from "../routing";
import { SpectroscopyDock } from "./dock";
import { GuideCaption } from "./guide";
import { LineCard } from "./line-card";
import { ElementsPanel, ViewPanel } from "./panels";
import { SpectroscopyTechnicalDetails } from "./technical-details";

/** Escape ends the guide, else closes the panel, else lets go of the line. */
const escapeSteps = (): EscapeStep[] => {
  const api = useSpectroscopy.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.selection !== null, () => api.select(null)],
  ];
};

/** The four views, as a pill that opens a list. */
function ViewPicker() {
  const t = useTranslations("spectroscopy");
  const view = useSpectroscopy((s) => s.view);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const go = (id: ViewId) => {
    setOpen(false);
    const path = pathForView(id);
    if (pathname !== path) router.push(path, { scroll: false });
  };
  return (
    <Picker
      aria-label={t("hud.views")}
      label={t(`views.${view}.title`)}
      detail={t(`views.${view}.kicker`)}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="flex flex-col gap-1">
        {VIEW_IDS.map((id) => (
          <ListItem key={id} selected={id === view} onClick={() => go(id)}>
            <span className="min-w-0">
              <span className="block truncate">{t(`views.${id}.title`)}</span>
              <span className="block truncate text-xs text-muted">{t(`views.${id}.hint`)}</span>
            </span>
            <span className={cn(kickerClass, "shrink-0")}>{t(`views.${id}.kicker`)}</span>
          </ListItem>
        ))}
      </div>
    </Picker>
  );
}

const PANELS: { id: Exclude<Panel, "none">; Icon: typeof Atom }[] = [
  { id: "elements", Icon: Atom },
  { id: "view", Icon: SlidersHorizontal },
];

export function SpectroscopyOverlay() {
  const t = useTranslations("spectroscopy");
  const tImmersive = useTranslations("immersive");
  const details = useRef<DialogHandle>(null);
  const ready = useSpectroscopy((s) => s.ready);
  const view = useSpectroscopy((s) => s.view);
  const panel = useSpectroscopy((s) => s.panel);
  const selection = useSpectroscopy((s) => s.selection);
  const guideOpen = useSpectroscopy((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);
  const api = useSpectroscopy.getState;
  useSceneEscape(escapeSteps);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? null : (
        <header className="hud-top pad-hud-top anim-fade absolute inset-x-0 top-0 z-[60]">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ViewPicker />
              <p className="line-clamp-2 max-w-md text-xs text-muted not-lg:hidden">
                {t(`views.${view}.hint`)}
              </p>
            </div>
            <Toolbar aria-label={t("hud.controls")} className="ml-auto shrink-0">
              <SpectroscopyTechnicalDetails ref={details} triggerClassName="not-md:hidden" />
              <Tooltip label={t("hud.guide")}>
                <IconButton
                  ref={guideButton}
                  aria-label={t("tour.start")}
                  onClick={() => api().startGuide()}
                >
                  <GraduationCap className="size-4 md:size-3.5" />
                </IconButton>
              </Tooltip>
              {PANELS.map(({ id, Icon }) => {
                const active = panel === id;
                return (
                  <Tooltip key={id} label={t(`hud.${id}`)}>
                    <IconButton
                      aria-label={t(`hud.${id}`)}
                      aria-expanded={active}
                      aria-controls={active ? `spectroscopy-${id}` : undefined}
                      active={active}
                      onClick={() => api().setPanel(active ? "none" : id)}
                    >
                      <Icon className="size-4 md:size-3.5" />
                    </IconButton>
                  </Tooltip>
                );
              })}
              <div className="not-md:hidden md:contents">
                <SimulationImmersiveToggle />
              </div>
              <SceneMoreMenu
                className="md:hidden"
                items={[
                  {
                    id: "details",
                    label: t("technicalDetails.open"),
                    icon: Info,
                    onSelect: () => details.current?.open(),
                  },
                  {
                    id: "immersive",
                    label: tImmersive("title"),
                    icon: Maximize2,
                    onSelect: () => setImmersive(true),
                  },
                ]}
              />
            </Toolbar>
          </div>
        </header>
      )}
      {!guideOpen && panel === "elements" ? (
        <ElementsPanel onClose={() => api().setPanel("none")} />
      ) : null}
      {!guideOpen && panel === "view" ? <ViewPanel onClose={() => api().setPanel("none")} /> : null}
      {panel === "none" && selection ? (
        <div className={cn(guideOpen && "not-md:hidden")}>
          <LineCard />
        </div>
      ) : null}
      {guideOpen ? <GuideCaption /> : <SpectroscopyDock />}
    </VisualizationOverlay>
  );
}
