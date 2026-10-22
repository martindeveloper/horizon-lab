"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

import { localeCookie } from "@/i18n/routing";
import { PAGE_URLS } from "@/lib/urls";

/**
 * Old /en and /cs links still serve their prerendered page. Keep the language
 * those links name, then show the clean URL without reloading.
 */
export function LocaleUrl() {
  const locale = useLocale();
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const prefix = `/${locale}`;
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return;
    document.cookie = localeCookie(locale);
    const clean = pathname.slice(prefix.length) || PAGE_URLS.home;
    window.history.replaceState(null, "", `${clean}${search}${hash}`);
  }, [locale]);
  return null;
}
