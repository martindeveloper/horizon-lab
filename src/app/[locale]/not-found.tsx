"use client";

import { useTranslations } from "next-intl";

import { StatusPage, statusPrimaryActionClass } from "@/components/status/status-page";
import { Link } from "@/i18n/navigation";
import { PAGE_URLS } from "@/lib/urls";

export default function NotFound() {
  const t = useTranslations();
  return (
    <StatusPage code="404" title={t("notFoundTitle")} description={t("notFoundBody")}>
      <Link href={PAGE_URLS.home} prefetch={false} className={statusPrimaryActionClass}>
        {t("returnHome")}
      </Link>
    </StatusPage>
  );
}
