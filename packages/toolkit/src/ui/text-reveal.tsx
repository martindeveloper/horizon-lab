"use client";
import { REDUCED_MOTION_QUERY } from "../environment";
import { useMediaQuery } from "./media-query";

export function textStagger(text: string, ms: number) {
  return Math.min(ms / 1000, 2.6 / Math.max(text.length, 1));
}

export function TextReveal({
  text,
  className,
  delay = 0,
  ms = 16,
  instant = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  ms?: number;
  instant?: boolean;
}) {
  const reduce = useMediaQuery(REDUCED_MOTION_QUERY);
  if (reduce || instant) return <span className={className}>{text}</span>;
  const stagger = textStagger(text, ms);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {Array.from(text).map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          aria-hidden="true"
          className="text-reveal-letter"
          style={{ animationDelay: `${delay + i * stagger}s` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
