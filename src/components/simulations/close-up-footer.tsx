import { ArrowLeft, ChevronDown, ChevronUp, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { Action } from "@horizon/toolkit/ui";

/**
 * A selection card's close-up actions, the same in every lab that flies to a body at its true
 * size: Close-up when the selection offers one, Back while one is open (`backLabel`: up a
 * level, or to the map), the Details toggle that unfolds the card on phones, and the note under
 * the body or craft in view. `awaiting` shows Close-up disabled with why (the Orrery in deep
 * time). The namespace holds the lab's `hud` copy.
 */
export function CloseUpFooter({
  namespace,
  offer,
  open,
  here,
  note,
  backLabel,
  awaiting,
  expanded,
  onExpand,
  onEnter,
  onLeave,
  children,
}: {
  namespace: string;
  /** The selection offers a close-up it is not already in. */
  offer: boolean;
  /** A close-up is open (of the selection or another of its system). */
  open: boolean;
  /** The open close-up is the selection's. */
  here: boolean;
  /** What stands in view: a body turned as it is now, or a craft. */
  note: "body" | "craft";
  backLabel: string;
  /** Why the close-up waits (shown disabled with this note), or null. */
  awaiting?: string | null;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  onEnter: () => void;
  onLeave: () => void;
  /** The lab's own controls below the note (the Sun's activity). */
  children?: ReactNode;
}) {
  const t = useTranslations(namespace);
  const awaitingNote = useId();
  if (!open && !offer && !awaiting) return null;
  return (
    <>
      {offer ? (
        <Action data-coach="closeUp" className="flex-1" onClick={onEnter}>
          <ZoomIn className="icon" aria-hidden />
          {t("hud.closeUp")}
        </Action>
      ) : null}
      {open ? (
        <Action
          data-coach="closeUp"
          variant={offer ? "ghost" : "glass"}
          className={offer ? "px-3" : "flex-1"}
          onClick={onLeave}
        >
          <ArrowLeft className="icon" aria-hidden />
          {backLabel}
        </Action>
      ) : !offer && awaiting ? (
        <Action data-coach="closeUp" className="flex-1" disabled aria-describedby={awaitingNote}>
          <ZoomIn className="icon" aria-hidden />
          {t("hud.closeUp")}
        </Action>
      ) : null}
      {open ? (
        <Action
          variant="ghost"
          className="px-3 md:hidden"
          aria-expanded={expanded}
          onClick={() => onExpand(!expanded)}
        >
          {expanded ? t("hud.hideDetails") : t("hud.details")}
          {expanded ? (
            <ChevronDown className="icon" aria-hidden />
          ) : (
            <ChevronUp className="icon" aria-hidden />
          )}
        </Action>
      ) : null}
      {here ? (
        <p className="w-full text-ui text-fg-secondary">
          {t(note === "craft" ? "hud.craftNote" : "hud.closeUpNote")}
        </p>
      ) : null}
      {awaiting ? (
        <p id={awaitingNote} className="w-full text-ui text-fg-secondary">
          {awaiting}
        </p>
      ) : null}
      {here ? children : null}
    </>
  );
}
