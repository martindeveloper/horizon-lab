import { Tooltip } from "./tooltip";
import { cn } from "./utils";

export type ScaleBarProps = {
  /** The length the bar stands for, formatted: "200 million ly". */
  text: string;
  /** Its length in CSS px. */
  px: number;
  /** The full sentence for the tooltip and screen readers: "Scale bar: 200 million ly". */
  label: string;
  /** Drawn straight on the dark scene rather than on a panel: space colours in either theme. */
  onScene?: boolean;
  className?: string;
};

/** A map's scale bar: the length above a bracket that eases to its new width. */
export function ScaleBar({ text, px, label, onScene = false, className }: ScaleBarProps) {
  return (
    <Tooltip label={label} className={cn("min-w-0 shrink-0", className)}>
      <span
        className={cn(
          "flex flex-col items-start gap-1 font-mono text-[11px] leading-none tracking-wide tabular-nums",
          onScene ? "text-space-muted" : "text-subtle",
        )}
      >
        <span aria-hidden className="whitespace-nowrap">
          {text}
        </span>
        <span
          aria-hidden
          className={cn(
            "h-1.5 border-x border-b transition-[width] duration-300",
            onScene ? "border-space-fg/50" : "border-fg/50",
          )}
          style={{ width: px }}
        />
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}
