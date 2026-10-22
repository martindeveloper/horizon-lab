import type { Metadata } from "next";
import Link from "next/link";

import { AppThemeProvider } from "@/components/providers";
import { Localized, StatusLocaleHead } from "@/components/status/status-locale";
import { StatusPage, statusPrimaryActionClass } from "@/components/status/status-page";
import { PAGE_URLS } from "@/lib/urls";

import cs from "../messages/cs.json";
import en from "../messages/en.json";

import "../styles.css";

export const metadata: Metadata = {
  title: "404 · Horizon",
  robots: { index: false, follow: false },
};

// No locale layout exists for arbitrary URLs: the cookie picks the copy, and the
// clean home URL resolves to the same language.
export default function GlobalNotFound() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <StatusLocaleHead />
      </head>
      <body className="bg-bg text-fg">
        <AppThemeProvider>
          <StatusPage
            fullPage
            code="404"
            title={<Localized copy={{ en: en.notFoundTitle, cs: cs.notFoundTitle }} />}
            description={<Localized copy={{ en: en.notFoundBody, cs: cs.notFoundBody }} />}
          >
            <Link prefetch={false} href={PAGE_URLS.home} className={statusPrimaryActionClass}>
              <Localized copy={{ en: en.returnHome, cs: cs.returnHome }} />
            </Link>
          </StatusPage>
        </AppThemeProvider>
      </body>
    </html>
  );
}
