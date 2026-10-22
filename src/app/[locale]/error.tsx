"use client";

import { useTranslations } from "next-intl";

import {
  StatusPage,
  statusActionClass,
  statusPrimaryActionClass,
} from "@/components/status/status-page";
import { Link } from "@/i18n/navigation";
import { PAGE_URLS } from "@/lib/urls";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  return (
    <StatusPage code="500" title={t("errorTitle")} description={t("errorBody")}>
      <button type="button" onClick={reset} className={statusPrimaryActionClass}>
        {t("tryAgain")}
      </button>
      <Link href={PAGE_URLS.home} prefetch={false} className={statusActionClass}>
        {t("returnHome")}
      </Link>
    </StatusPage>
  );
}
