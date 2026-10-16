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
        <span className="inline-flex h-full items-center gap-2">
          <HorizonMark className="size-3.5" />
          {/* The narrowest phones keep the mark, About, Credits and the clock on one line. */}
          <span className="max-[23rem]:sr-only">Horizon</span>
          <span className="mx-1 h-3 w-px bg-border-strong max-[23rem]:hidden" aria-hidden />
          <Link
            href="/about"
            prefetch={false}
            className="inline-flex h-full items-center rounded-sm text-muted underline decoration-accent/50 decoration-1 underline-offset-[5px] transition-colors hover:text-fg hover:decoration-accent focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            {t("about")}
          </Link>
          <span className="mx-1 h-3 w-px bg-border-strong" aria-hidden />
          <Link
            href="/credits"
            prefetch={false}
            className="inline-flex h-full items-center rounded-sm text-muted underline decoration-accent/50 decoration-1 underline-offset-[5px] transition-colors hover:text-fg hover:decoration-accent focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            {t("credits")}
          </Link>
          {/* Phones reach the repository from About; the footer line stays one line. */}
          <span className="mx-1 hidden h-3 w-px bg-border-strong sm:block" aria-hidden />
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-full items-center rounded-sm text-muted underline decoration-accent/50 decoration-1 underline-offset-[5px] transition-colors hover:text-fg hover:decoration-accent focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden sm:inline-flex"
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
