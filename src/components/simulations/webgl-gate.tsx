"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";

import { StatusPage, statusPrimaryActionClass } from "@/components/status/status-page";
import { Link } from "@/i18n/navigation";
import { subscribeDebug, webglOverride } from "@/lib/debug";
import { probeWebGL, type WebGLSupport } from "@horizon/toolkit/rendering";
import { PanelHeader, Surface, useImmersive } from "@horizon/toolkit/ui";

import { SimulationLoadingPage } from "./loading";

// One probe per page session: browsers cap live WebGL contexts.
let support: WebGLSupport | undefined;
let noticeDismissed = false;

// `Horizon.Debug.webgl()` can force a result; it skips the real probe entirely.
const clientSupport = () => webglOverride() ?? (support ??= probeWebGL());
const serverSupport = () => null;

/**
 * A simulation's client boundary: its root loads on the client only (the stores read the
 * browser, the scene draws in it), behind `SimulationLoadingPage` titled by the namespace's
 * `app` while its chunk downloads and, where it draws WebGL (`gate`), behind the WebGL check.
 * The route layout keeps what it returns mounted across the simulation's views.
 */
export function simulationClient(
  namespace: string,
  load: () => Promise<ComponentType>,
  { gate = true }: { gate?: boolean } = {},
) {
  function Loading() {
    const t = useTranslations(namespace);
    return <SimulationLoadingPage title={t("app")} />;
  }
  const Simulation = dynamic(load, { ssr: false, loading: Loading });
  return function SimulationClient() {
    return gate ? (
      <WebGLGate fallback={<Loading />}>
        <Simulation />
      </WebGLGate>
    ) : (
      <Simulation />
    );
  };
}

/**
 * Checks WebGL 2 before a simulation's renderer chunk loads. The server pass and
 * hydration render `fallback`; without WebGL 2 the simulation never mounts.
 */
export function WebGLGate({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const status = useSyncExternalStore(subscribeDebug, clientSupport, serverSupport);
  if (status === null) return fallback;
  if (status === "unavailable") return <WebGLUnavailable />;
  return (
    <>
      {children}
      {status === "software" ? <SoftwareNotice /> : null}
    </>
  );
}

function WebGLUnavailable() {
  const t = useTranslations();
  return (
    <StatusPage
      stage
      code="WebGL"
      title={t("webgl.unavailableTitle")}
      description={t("webgl.unavailableBody")}
    >
      <Link href="/" prefetch={false} className={statusPrimaryActionClass}>
        {t("returnHome")}
      </Link>
    </StatusPage>
  );
}

function SoftwareNotice() {
  const t = useTranslations("webgl");
  // A forced debug result always shows the notice, even after a real dismissal.
  const [open, setOpen] = useState(() => !noticeDismissed || webglOverride() !== null);
  const immersive = useImmersive();
  if (!open || immersive) return null;
  return (
    <Surface
      role="note"
      aria-label={t("softwareTitle")}
      className="anim-rise absolute inset-x-4 top-16 z-[70] mx-auto max-w-sm rounded-lg p-4"
    >
      <PanelHeader
        title={t("softwareTitle")}
        closeLabel={t("dismiss")}
        onClose={() => {
          noticeDismissed = true;
          setOpen(false);
        }}
      />
      <p className="mt-1 text-sm leading-relaxed text-muted">{t("softwareBody")}</p>
    </Surface>
  );
}
