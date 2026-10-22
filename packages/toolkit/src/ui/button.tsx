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
        "inline-flex size-11 items-center justify-center rounded-control text-fg-primary transition-colors duration-feedback ease-standard hover:bg-fg-primary/10 focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-40 md:size-9",
        className,
      )}
      {...props}
    />
  );
}
