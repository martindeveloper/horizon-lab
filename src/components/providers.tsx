"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { storageKey } from "@horizon/toolkit/storage";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey={storageKey("theme")}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
