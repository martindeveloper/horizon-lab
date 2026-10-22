"use client";

import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "./button";
import { Kicker } from "./kicker";
import { cn } from "./utils";

export type PanelHeaderProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode;
  kicker?: ReactNode;
} & ({ onClose?: undefined; closeLabel?: undefined } | { onClose: () => void; closeLabel: string });

/** Kicker, display title and optional close button at the top of a panel, card or sheet. */
export function PanelHeader({
  title,
  kicker,
  onClose,
  closeLabel,
  className,
  ...props
}: PanelHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)} {...props}>
      <div className="min-w-0">
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <h2 className="font-display text-base font-medium tracking-tight text-fg-primary">
          {title}
        </h2>
      </div>
      {onClose ? (
        <Button
          className="shrink-0 not-md:-my-1 not-md:-mr-1.5"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
