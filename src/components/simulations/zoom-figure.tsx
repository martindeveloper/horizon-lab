"use client";

import { useTranslations } from "next-intl";

import { FigureZoom, type FigureZoomProps } from "@horizon/toolkit/ui";

/** A chart or diagram any lab can enlarge and zoom into, with the shared `figure` copy. */
export function ZoomFigure(props: Omit<FigureZoomProps, "labels">) {
  const t = useTranslations("figure");
  return (
    <FigureZoom
      labels={{
        open: t("enlarge"),
        close: t("close"),
        zoomIn: t("zoomIn"),
        zoomOut: t("zoomOut"),
        reset: t("reset"),
        fill: t("fill"),
        restore: t("restore"),
      }}
      {...props}
    />
  );
}
