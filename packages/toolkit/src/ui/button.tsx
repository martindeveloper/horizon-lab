"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "./utils";

export function Button({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex size-11 ui-disabled items-center justify-center rounded-control ui-row text-fg-primary ui-focus transition-colors duration-feedback ease-standard md:size-9",
        className,
      )}
      {...props}
    />
  );
}
