import { Suspense, type ReactNode } from "react";

import { DebugTools } from "@/components/debug/debug-tools";
import { DEBUG } from "@/config";
import type { Locale } from "@/i18n/routing";

import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";
import { Wordmark } from "./brand";
import { DesktopNotice } from "./desktop-notice";
import { Sky } from "./sky";

/**
 * One sky, one glass header, one preferences surface for the whole collection.
 * Catalogue pages scroll over the sky; simulation stages paint their own scene.
 */
export function AppShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <div className="app-shell isolate flex min-h-dvh flex-col">
      <Suspense fallback={<div className="horizon-sky" aria-hidden="true" />}>
        <Sky />
      </Suspense>
      <header className="app-header hairline-solar sticky top-0 z-[100] shrink-0">
        <Suspense
          fallback={
            <div className="app-bar flex h-full items-center">
              <Wordmark />
            </div>
          }
        >
          <AppHeader />
        </Suspense>
      </header>
      {children}
      <AppFooter locale={locale} />
      <DesktopNotice />
      {DEBUG ? <DebugTools /> : null}
    </div>
  );
}
