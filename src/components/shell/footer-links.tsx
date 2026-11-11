import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { REPOSITORY_URL } from "@/config";
import { Link } from "@/i18n/navigation";
import { PAGE_URLS } from "@/lib/urls";

import { SiderealClock } from "./sidereal-clock";

type FooterKey = "about" | "changelog" | "credits" | "newTab" | "sidereal";

/** In the phone menu, GitHub stays visible at every width and `onNavigate` closes the menu. */
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
        {/* A phone's line has no room for a third page; it shows from `sm` up, as GitHub does. */}
        <span className="footer-dot hidden sm:block" aria-hidden />
        <Link
          href={PAGE_URLS.changelog}
          prefetch={false}
          onClick={onNavigate}
          className="footer-link hidden sm:inline-flex"
        >
          {t("changelog")}
        </Link>
        <span className={menu ? "footer-dot" : "footer-dot hidden sm:block"} aria-hidden />
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={menu ? "footer-link inline-flex gap-1" : "footer-link hidden sm:inline-flex"}
        >
          GitHub
          {menu ? <ArrowUpRight className="icon size-icon-micro" aria-hidden /> : null}
          <span className="sr-only"> ({t("newTab")})</span>
        </a>
      </span>
      <SiderealClock label={t("sidereal")} />
    </>
  );
}
