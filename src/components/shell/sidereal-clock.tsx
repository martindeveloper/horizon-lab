"use client";

import { useEffect, useState } from "react";

import { skyNow, skyRunsFast, subscribeDebug } from "@/lib/debug";
import { OBSERVER, siderealTime } from "@/space/observer-sky";

function format(date: Date) {
  const hours = siderealTime(date, OBSERVER.longitude) / 15;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m`;
}

/** Local sidereal time at the observatory whose sky the pages show. Client-only. */
export function SiderealClock({ label }: { label: string }) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setValue(format(new Date(skyNow())));
    let id = 0;
    const start = () => {
      tick();
      window.clearInterval(id);
      id = window.setInterval(tick, skyRunsFast() ? 250 : 30000);
    };
    start();
    const unsubscribe = subscribeDebug(start);
    return () => {
      window.clearInterval(id);
      unsubscribe();
    };
  }, []);
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <abbr title={label} className="no-underline">
        LST
      </abbr>
      <span className="text-fg-secondary">{value}</span>
    </span>
  );
}
