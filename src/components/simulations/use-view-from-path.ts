"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";

/** The part of a simulation's store that its URL names. */
export type ViewStore<View> = {
  getState: () => { view: View; setView: (view: View) => void };
  subscribe: (listener: () => void) => () => void;
};

/**
 * Keeps a simulation's view on its URL: a visitor's navigation to another view's path (the view
 * picker, a link, back) changes the address and the view follows. With `pathFor`, the view and
 * the address stay one both ways: a view the store changes itself (the guide) puts the address
 * right with a replace. While such a replace is on its way the address speaks for the store, not
 * for the visitor: when it lands and the view has moved on meanwhile, the address is put right
 * again instead of dragging the view back.
 */
export function useViewFromPath<View>(
  store: ViewStore<View>,
  viewFromPath: (pathname: string) => View,
  pathFor?: (view: View) => string,
) {
  const pathname = usePathname();
  const router = useRouter();
  const view = useSyncExternalStore(
    store.subscribe,
    () => store.getState().view,
    () => store.getState().view,
  );
  /** The address this hook asked for and has not seen land yet. */
  const requested = useRef<string | null>(null);
  const last = useRef(view);

  useLayoutEffect(() => {
    const state = store.getState();
    if (pathFor && requested.current !== null) {
      if (pathname !== requested.current) return;
      requested.current = null;
      const wanted = pathFor(state.view);
      if (pathname !== wanted) {
        requested.current = wanted;
        router.replace(wanted, { scroll: false });
      }
      return;
    }
    const id = viewFromPath(pathname);
    if (state.view !== id) state.setView(id);
  }, [pathname, router, store, viewFromPath, pathFor]);

  useEffect(() => {
    if (!pathFor || last.current === view) return;
    last.current = view;
    const path = pathFor(view);
    if (requested.current === null && viewFromPath(pathname) === view) return;
    if (requested.current === path) return;
    requested.current = path;
    router.replace(path, { scroll: false });
  }, [view, pathname, router, pathFor, viewFromPath]);
}
