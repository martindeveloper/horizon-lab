"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Ref } from "react";

import { proseArgs, type ProseFigure } from "@/lib/facts";
import type { Formula } from "@horizon/toolkit/science";
import { TechnicalDetails, type DialogHandle, type TechnicalDocument } from "@horizon/toolkit/ui";

/** A formula as text, or the ID of an `Equation` the feature registers (printed from the library). */
type EquationEntry = string | { equation: string };

type Specification = {
  features: string[];
  references?: TechnicalDocument["references"];
  sections: { id: string; equations: EquationEntry[] }[];
};

/** Resolves equation IDs to their text; an unknown ID is a bug, not a blank line. */
function equationText(entry: EquationEntry, equations: Record<string, Formula> = {}) {
  if (typeof entry === "string") return entry;
  const equation = equations[entry.equation];
  if (!equation) throw new Error(`Unknown equation "${entry.equation}"`);
  return equation.toString();
}

/** How a feature's details are reached besides their own button: a handle, and that button hidden. */
export type TechnicalDetailsAccess = {
  /** Opens the dialog from elsewhere, such as a phone's More menu. */
  ref?: Ref<DialogHandle>;
  triggerClassName?: string;
};

/** Feature modules own their specifications; this adapter only supplies the common translation mapping. */
export function SimulationTechnicalDetails({
  ref,
  triggerClassName,
  namespace,
  specification,
  equations,
  values,
  figures,
}: TechnicalDetailsAccess & {
  namespace: string;
  specification: Specification;
  /** The feature's formulas by ID, from `@horizon/toolkit/science` or its own `defineEquation`s. */
  equations?: Record<string, Formula>;
  /** ICU arguments for prose that quotes the feature's own parameters. */
  values?: Record<string, number | string>;
  /** Catalogue figures the prose quotes, by placeholder, printed in the page's language. */
  figures?: Readonly<Record<string, ProseFigure>>;
}) {
  const t = useTranslations(`${namespace}.technicalDetails`);
  const locale = useLocale();
  const args = figures ? { ...values, ...proseArgs(figures, locale) } : values;
  return (
    <TechnicalDetails
      {...(ref !== undefined ? { ref } : {})}
      {...(triggerClassName !== undefined ? { triggerClassName } : {})}
      labels={{
        open: t("open"),
        close: t("close"),
        features: t("featuresTitle"),
        references: t("references"),
      }}
      document={{
        title: t("title"),
        summary: t("summary"),
        ...(specification.references !== undefined ? { references: specification.references } : {}),
        features: specification.features.map((id) => t(`features.${id}`, args)),
        sections: specification.sections.map((section) => ({
          ...section,
          equations: section.equations.map((entry) => equationText(entry, equations)),
          title: t(`sections.${section.id}.title`),
          body: t(`sections.${section.id}.body`, args),
        })),
      }}
    />
  );
}
