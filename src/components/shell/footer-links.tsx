import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { REPOSITORY_URL } from "@/config";
import { Link } from "@/i18n/navigation";
import { PAGE_URLS } from "@/lib/urls";

import { SiderealClock } from "./sidereal-clock";

type FooterKey = "about" | "credits" | "newTab" | "sidereal";

/**
 * About · Credits · GitHub, then the observatory clock: the footer's line, and the same line
 * at the foot of the phone menu. `lead` goes before About; `onNavigate` closes a menu as a
 * link is taken. In the menu GitHub shows on every width, with its arrow; the footer keeps it
 * for wide screens, so phones reach the repository from About and the line stays one line.
 */
export function FooterLinks({
  t,
  lead,
  menu = false,
  onNavigate,
}: {
  t: (key: FooterKey) => string;
  lead?: ReactNode;
  menu?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <span className="inline-flex h-full items-center gap-2.5">
        {lead}
        <Link
          href={PAGE_URLS.about}
          prefetch={false}
          onClick={onNavigate}
          className="footer-link inline-flex"
        >
          {t("about")}
        </Link>
        <span className="footer-dot" aria-hidden />
        <Link
          href={PAGE_URLS.credits}
          prefetch={false}
          onClick={onNavigate}
          className="footer-link inline-flex"
        >
          {t("credits")}
        </Link>
        <span className={menu ? "footer-dot" : "footer-dot hidden sm:block"} aria-hidden />
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={menu ? "footer-link inline-flex gap-1" : "footer-link hidden sm:inline-flex"}
        >
          GitHub
          {menu ? <ArrowUpRight className="size-3" aria-hidden /> : null}
          <span className="sr-only"> ({t("newTab")})</span>
        </a>
      </span>
      <SiderealClock label={t("sidereal")} />
    </>
  );
}
