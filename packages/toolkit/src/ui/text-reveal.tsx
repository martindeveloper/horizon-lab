"use client";
import { motion, useReducedMotion } from "motion/react";

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
  const reduce = useReducedMotion();
  if (reduce || instant) return <span className={className}>{text}</span>;
  const stagger = textStagger(text, ms);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={`${i}-${ch}`}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: delay + i * stagger,
            duration: 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
