"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { StoreApi } from "zustand";

import { ANCHOR_IDS } from "@/lib/urls";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import type { SimulationDrift } from "./drift";
import { SimulationImmersive } from "./immersive";
import { SimulationLoading } from "./loading";
import { freshVisit, useFreshVisit } from "./use-fresh-visit";
import { useViewFromPath, type ViewStore } from "./use-view-from-path";

/**
 * What the root reads of a simulation's store: its first frame (`ready`, or what `ready` names
 * in a store that calls it otherwise), and a guide the immersive view ends.
 */
type RootState = { ready?: boolean; guideOpen?: boolean; endGuide?: () => void };

/** A simulation's store as the root holds it: the hook itself, or an adapter over one. */
export type RootStore<S extends RootState> = Pick<
  StoreApi<S>,
  "getState" | "setState" | "getInitialState" | "subscribe"
>;

/**
 * The component a simulation's layout keeps mounted across its views, the same in every
 * simulation: the stage with its name for assistive technology, the canvas, the overlay in the
 * immersive view (entering it ends the guide, whose caption it hides), and the loading veil
 * until the first frame. The view follows the address (`useViewFromPath`), and leaving the
 * simulation puts the store back as it was first made (`useFreshVisit`), then `onLeave`.
 */
export function SimulationRoot<View, S extends RootState>({
  namespace,
  store,
  views,
  heading,
  tone,
  drift,
  ready = (state) => state.ready === true,
  onImmersive,
  onLeave,
  canvas,
  overlay,
  children,
}: {
  /** The feature's message namespace: `app` names the simulation. */
  namespace: string;
  store: RootStore<S>;
  /**
   * The view on the address: the store as the address sees it (the hook, or an adapter), the
   * view a path names and, where the store changes views itself, the path a view takes.
   */
  views: {
    store: ViewStore<View>;
    fromPath: (pathname: string) => View;
    pathFor?: (view: View) => string;
  };
  /** What follows the simulation's name in its heading: the view's, say. */
  heading?: ReactNode;
  /** The scene's tone where it is not the dark sky (the Sun). */
  tone?: "bright";
  /** The simulation's drift (`useSimulationDrift`), for the immersive view's controls. */
  drift?: SimulationDrift;
  /** The first frame is drawn; `ready` by default. */
  ready?: (state: S) => boolean;
  /** What entering the immersive view does; ending the guide by default. */
  onImmersive?: () => void;
  /** What leaving the simulation does besides restoring the store; a module function, made once. */
  onLeave?: () => void;
  canvas: ReactNode;
  overlay: ReactNode;
  /** Anything else on the stage, outside the immersive view (a notice). */
  children?: ReactNode;
}) {
  const t = useTranslations(namespace);
  const isReady = useSyncExternalStore(
    store.subscribe,
    () => ready(store.getState()),
    () => false,
  );
  const restore = useMemo(() => freshVisit(store), [store]);
  const reset = useCallback(() => {
    restore();
    onLeave?.();
  }, [restore, onLeave]);
  const leaveGuide = useCallback(() => {
    const state = store.getState();
    if (state.guideOpen) state.endGuide?.();
  }, [store]);

  useViewFromPath(views.store, views.fromPath, views.pathFor);
  useFreshVisit(reset);

  return (
    <VisualizationShell
      id={ANCHOR_IDS.mainContent}
      tabIndex={-1}
      className="h-full"
      {...(tone === undefined ? {} : { "data-scene-tone": tone })}
    >
      <h1 className="sr-only">
        {t("app")}
        {heading === undefined ? null : <> · {heading}</>}
      </h1>
      {canvas}
      <SimulationImmersive
        onEnter={onImmersive ?? leaveGuide}
        {...(drift === undefined ? {} : { drift })}
      >
        {overlay}
      </SimulationImmersive>
      {children}
      <LoadingOverlay ready={isReady}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}
