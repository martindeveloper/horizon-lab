"use client";

import { Info, TriangleAlert } from "lucide-react";
import { useId, type ComponentProps } from "react";

import { cn } from "./utils";

export type CalloutProps = ComponentProps<"div"> & {
  title: string;
  tone?: "info" | "warning";
};

/** A static, labelled note. The host supplies the wording and chooses its significance. */
export function Callout({ title, tone = "info", children, className, ...props }: CalloutProps) {
  const titleId = useId();
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      role="note"
      aria-labelledby={titleId}
      className={cn(
        "rounded-control border p-panel-row",
        tone === "warning"
          ? "border-accent/25 bg-accent/5"
          : "border-border bg-surface-tertiary/40",
        className,
      )}
      {...props}
    >
      <p
        id={titleId}
        className={cn(
          "flex items-start gap-2 text-ui font-medium",
          tone === "warning" ? "text-accent" : "text-fg-primary",
        )}
      >
        <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {title}
      </p>
      <div className="mt-2 text-ui leading-relaxed text-fg-secondary">{children}</div>
    </div>
  );
}
