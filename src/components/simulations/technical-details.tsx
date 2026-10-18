"use client";

import { useTranslations } from "next-intl";

import type { Formula } from "@horizon/toolkit/science";
import { TechnicalDetails, type TechnicalDocument } from "@horizon/toolkit/ui";

/** A formula as text, or the ID of an `Equation` the feature registers (printed from the library). */
export type EquationEntry = string | { equation: string };

type Specification = {
  features: string[];
  references?: TechnicalDocument["references"];
  sections: { id: string; equations: EquationEntry[] }[];
};

/** Resolves equation IDs to their text; an unknown ID is a bug, not a blank line. */
export function equationText(entry: EquationEntry, equations: Record<string, Formula> = {}) {
  if (typeof entry === "string") return entry;
  const equation = equations[entry.equation];
  if (!equation) throw new Error(`Unknown equation "${entry.equation}"`);
  return equation.toString();
}

/** Feature modules own their JSON; this adapter only supplies the common translation mapping. */
export function SimulationTechnicalDetails({
  namespace,
  specification,
  equations,
  values,
}: {
  namespace: string;
  specification: Specification;
  /** The feature's formulas by ID, from `@horizon/toolkit/science` or its own `defineEquation`s. */
  equations?: Record<string, Formula>;
  /** ICU arguments for prose that quotes the feature's own parameters. */
  values?: Record<string, number | string>;
}) {
  const t = useTranslations(`${namespace}.technicalDetails`);
  return (
    <TechnicalDetails
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
        features: specification.features.map((id) => t(`features.${id}`, values)),
        sections: specification.sections.map((section) => ({
          ...section,
          equations: section.equations.map((entry) => equationText(entry, equations)),
          title: t(`sections.${section.id}.title`),
          body: t(`sections.${section.id}.body`, values),
        })),
      }}
    />
  );
}
