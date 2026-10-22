import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";

import { HorizonMark } from "./brand";
import { FooterLinks } from "./footer-links";

export async function AppFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "shell" });
  return (
    <footer className="app-footer mt-auto shrink-0 font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
      <div className="app-bar flex h-full items-center justify-between gap-4">
        <FooterLinks
          t={t}
          lead={
            <>
              <span className="inline-flex items-center gap-2 text-muted">
                <HorizonMark className="size-3.5" />
                {/* The narrowest phones keep the mark, About, Credits and the clock on one line. */}
                <span className="max-[23rem]:sr-only">Horizon</span>
              </span>
              <span className="footer-dot max-[23rem]:hidden" aria-hidden />
            </>
          }
        />
      </div>
    </footer>
  );
}
