"use client";

import { useLayoutEffect } from "react";

import { usePathname } from "@/i18n/navigation";

/** Keeps a simulation's view on its URL: a navigation to another view's path flies there. */
export function useViewFromPath<View>(
  getState: () => { view: View; setView: (view: View) => void },
  viewFromPath: (pathname: string) => View,
) {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const id = viewFromPath(pathname);
    const state = getState();
    if (state.view !== id) state.setView(id);
  }, [pathname, getState, viewFromPath]);
}
