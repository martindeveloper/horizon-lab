import { useTranslations } from "next-intl";
import { useRef } from "react";

import { PanelHeader, Sheet, kickerClass, useFocusHandoff } from "@horizon/toolkit/ui";

/** A titled group inside a rail. */
export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={kickerClass}>{title}</h3>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Side rail on wide screens, bottom sheet on phones. */
export function Rail({
  id,
  title,
  onClose,
  children,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("orrery");
  const rail = useRef<HTMLElement>(null);
  useFocusHandoff(rail);
  return (
    <>
      <aside
        ref={rail}
        id={id}
        tabIndex={-1}
        className="orrery-panel glass-panel anim-rail pointer-events-auto absolute top-14 right-(--hud-gutter) bottom-[var(--orrery-clear,1rem)] z-40 hidden w-80 flex-col overflow-hidden rounded-lg outline-hidden md:flex"
        aria-label={title}
      >
        <PanelHeader
          title={title}
          onClose={onClose}
          closeLabel={t("hud.close")}
          className="items-center border-b border-border px-4 py-3"
        />
        <div className="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
      </aside>
      <Sheet
        className="md:hidden"
        panelClassName="orrery-panel"
        aria-label={title}
        dismissLabel={t("hud.close")}
        onDismiss={onClose}
      >
        <PanelHeader
          title={title}
          onClose={onClose}
          closeLabel={t("hud.close")}
          className="items-center py-1.5"
        />
        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pt-2 pb-2">
          {children}
        </div>
      </Sheet>
    </>
  );
}
