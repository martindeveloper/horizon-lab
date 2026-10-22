import { cn } from "@horizon/toolkit/ui";

export function HorizonMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-5", className)} fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" className="stroke-current" strokeWidth="1.5" />
      <path d="M16 9.5a6.5 6.5 0 0 1 6.5 6.5h-13A6.5 6.5 0 0 1 16 9.5Z" className="fill-accent" />
      <line x1="5" y1="16" x2="27" y2="16" className="stroke-accent" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-fg-primary", className)}
      data-brand="horizon"
    >
      <HorizonMark className="text-fg-secondary" />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Horizon</span>
    </span>
  );
}
