import { cn } from "@horizon/toolkit/ui";

/** One clock in the rates list; refs let the frame loop update it without re-rendering. */
export function ClockRow({
  label,
  you = false,
  rowRef,
  dotRef,
  labelRef,
  barRef,
  rateRef,
  onHover,
}: {
  label: string;
  you?: boolean;
  rowRef?: (el: HTMLLIElement | null) => void;
  dotRef?: (el: HTMLSpanElement | null) => void;
  labelRef?: (el: HTMLSpanElement | null) => void;
  barRef?: (el: HTMLSpanElement | null) => void;
  rateRef?: (el: HTMLSpanElement | null) => void;
  onHover?: (on: boolean) => void;
}) {
  return (
    <li
      ref={rowRef}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      className="flex h-5 items-center gap-3 transition-opacity duration-scene ease-standard"
    >
      <span
        ref={dotRef}
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full opacity-40",
          you ? "bg-solar shadow-[0_0_8px_var(--color-solar)]" : "bg-space-fg",
        )}
      />
      <span
        ref={labelRef}
        className={cn("w-14 shrink-0 tracking-wide", you ? "text-accent uppercase" : "text-muted")}
      >
        {label}
      </span>
      <span aria-hidden className="relative h-px min-w-0 flex-1 bg-fg/10">
        <span
          ref={barRef}
          className={cn(
            "absolute inset-0 origin-left transition-transform duration-control ease-standard",
            you ? "bg-accent/70" : "bg-fg/45",
          )}
        />
      </span>
      <span ref={rateRef} className="w-11 shrink-0 text-right text-fg">
        1.00×
      </span>
    </li>
  );
}
