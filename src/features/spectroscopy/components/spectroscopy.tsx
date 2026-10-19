import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef } from "react";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { useSpectroscopy } from "../lib/store";
import { pathForView, viewFromPath } from "../routing";
import { SpectroscopyOverlay } from "./overlay";
import { Stage } from "./stage";
import { useGuideMotion } from "./use-guide-motion";

/** Leaving the simulation starts the next visit fresh, with new mystery cases dealt. */
const restore = freshVisit(useSpectroscopy);
const reset = () => {
  restore();
  useSpectroscopy.getState().shuffleCases();
};

/** The immersive view hides the guide's caption, so it ends the guide; nothing else. */
function leaveGuide() {
  const state = useSpectroscopy.getState();
  if (state.guideOpen) state.endGuide();
}

/**
 * The view and the address stay one. A visitor's navigation (the view picker, a link, back)
 * changes the address and the view follows; the guide changes the view and the address follows
 * with a replace. While such a replace is on its way the address speaks for the store, not for
 * the visitor: when it lands and the guide has moved on meanwhile, the address is put right
 * again instead of dragging the view back.
 */
function useViewAddress() {
  const view = useSpectroscopy((s) => s.view);
  const pathname = usePathname();
  const router = useRouter();
  /** The address this hook asked for and has not seen land yet. */
  const requested = useRef<string | null>(null);
  const last = useRef(view);

  useLayoutEffect(() => {
    const state = useSpectroscopy.getState();
    const wanted = pathForView(state.view);
    if (requested.current !== null) {
      if (pathname !== requested.current) return;
      requested.current = null;
      if (pathname !== wanted) {
        requested.current = wanted;
        router.replace(wanted, { scroll: false });
      }
      return;
    }
    const id = viewFromPath(pathname);
    if (state.view !== id) state.setView(id);
  }, [pathname, router]);

  useEffect(() => {
    if (last.current === view) return;
    last.current = view;
    const path = pathForView(view);
    if (requested.current === null && viewFromPath(pathname) === view) return;
    if (requested.current === path) return;
    requested.current = path;
    router.replace(path, { scroll: false });
  }, [view, pathname, router]);
}

export function Spectroscopy() {
  const t = useTranslations("spectroscopy");
  const ready = useSpectroscopy((s) => s.ready);
  const view = useSpectroscopy((s) => s.view);

  useViewAddress();
  useGuideMotion();
  useFreshVisit(reset);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}.title`)}
      </h1>
      <Stage />
      <SimulationImmersive onEnter={leaveGuide}>
        <SpectroscopyOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}
