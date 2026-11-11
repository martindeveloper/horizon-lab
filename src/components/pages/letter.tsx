import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn, kickerClass } from "@horizon/toolkit/ui";

import { HorizonMark } from "../shell/brand";

/** Margin column for labels beside a ~65-character text column, as in a printed essay. */
export const letterGrid = "lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-14";

/** The title's quieter half: `<em>` in the message, muted on the page. */
export const letterEmphasis = (chunks: ReactNode) => (
  <span className="text-fg-secondary">{chunks}</span>
);

export function LetterHeader({
  id,
  kicker,
  title,
  lead,
  leadClassName,
  className,
  children,
}: {
  id: string;
  kicker: string;
  title: ReactNode;
  lead: string;
  leadClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn(letterGrid, className)}>
      <p className="flex items-center gap-2.5 lg:justify-end lg:self-start lg:pt-[1.15rem]">
        <HorizonMark className="size-4 text-fg-secondary" />
        <span className={kickerClass}>{kicker}</span>
      </p>
      <div>
        <h1
          id={id}
          className="mt-8 font-display text-[2.5rem] leading-[1.05] font-medium tracking-[-0.035em] text-balance text-fg-primary sm:text-5xl lg:mt-0 lg:text-[3.5rem]"
        >
          {title}
        </h1>
        <p
          className={cn(
            "mt-7 text-xl leading-normal text-balance text-fg-secondary sm:text-[1.375rem]",
            leadClassName,
          )}
        >
          {lead}
        </p>
        {children}
      </div>
    </header>
  );
}

/** One part of a letter: its label hangs in the margin on wide screens. */
export function LetterPart({
  id,
  label,
  className,
  children,
}: {
  /** The label's id, which names the part. */
  id: string;
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-16 sm:mt-20", letterGrid, className)}>
      <h2
        id={id}
        className={cn(kickerClass, "text-balance lg:pt-[0.7em] lg:text-right lg:leading-relaxed")}
      >
        {label}
      </h2>
      <div className="mt-5 space-y-6 lg:mt-0">{children}</div>
    </section>
  );
}

/** An inline link that leaves the site, marked with an arrow and announced as opening a new tab. */
export function ExternalLink({
  href,
  newTab,
  className,
  children,
}: {
  href: string;
  newTab: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <ArrowUpRight
        className="ml-0.5 inline icon size-[0.8em] align-baseline text-accent"
        aria-hidden
      />
      <span className="sr-only">({newTab})</span>
    </a>
  );
}
