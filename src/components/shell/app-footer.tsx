import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { REPOSITORY_URL } from "@/lib/links";

import { HorizonMark } from "./brand";
import { SiderealClock } from "./sidereal-clock";

/** One quiet line under every page: the mark, the name, About, Credits, GitHub, and the observatory clock. */
export async function AppFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "shell" });
  return (
    <footer className="app-footer mt-auto shrink-0 font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
      <div className="app-bar flex h-full items-center justify-between gap-4">
        <span className="inline-flex h-full items-center gap-2.5">
          <span className="inline-flex items-center gap-2 text-muted">
            <HorizonMark className="size-3.5" />
            {/* The narrowest phones keep the mark, About, Credits and the clock on one line. */}
            <span className="max-[23rem]:sr-only">Horizon</span>
          </span>
          <span className="footer-dot max-[23rem]:hidden" aria-hidden />
          <Link href="/about" prefetch={false} className="footer-link">
            {t("about")}
          </Link>
          <span className="footer-dot" aria-hidden />
          <Link href="/credits" prefetch={false} className="footer-link">
            {t("credits")}
          </Link>
          {/* Phones reach the repository from About; the footer line stays one line. */}
          <span className="footer-dot hidden sm:block" aria-hidden />
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link hidden sm:inline-flex"
          >
            GitHub
            <span className="sr-only"> ({t("newTab")})</span>
          </a>
        </span>
        <SiderealClock label={t("sidereal")} />
      </div>
    </footer>
  );
}
