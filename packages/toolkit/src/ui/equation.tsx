import type { ReactNode } from "react";

import { cn } from "./utils";

export function Equation({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        "py-1.5 text-center font-mono text-xs leading-relaxed text-fg md:text-sm",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <sub className="text-xs">{children}</sub>;
}
