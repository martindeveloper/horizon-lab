import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn, kickerClass } from "@horizon/toolkit/ui";

import { HorizonMark } from "../shell/brand";

/** Margin column for labels beside a ~65-character text column, as in a printed essay. */
export const letterGrid = "lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-14";

/** The title's quieter half: `<em>` in the message, muted on the page. */
export const letterEmphasis = (chunks: ReactNode) => <span className="text-muted">{chunks}</span>;

/**
 * A letter's opening: the mark and a kicker in the margin, the display title, a lead, then
 * whatever the page adds under them.
 */
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
        <HorizonMark className="size-4 text-muted" />
        <span className={kickerClass}>{kicker}</span>
      </p>
      <div>
        <h1
          id={id}
          className="mt-8 font-display text-[2.5rem] leading-[1.05] font-medium tracking-[-0.035em] text-balance text-fg sm:text-5xl lg:mt-0 lg:text-[3.5rem]"
        >
          {title}
        </h1>
        <p
          className={cn(
            "mt-7 text-xl leading-normal text-balance text-muted sm:text-[1.375rem]",
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
      <ArrowUpRight className="ml-0.5 inline size-[0.8em] align-baseline text-accent" aria-hidden />
      <span className="sr-only">({newTab})</span>
    </a>
  );
}
