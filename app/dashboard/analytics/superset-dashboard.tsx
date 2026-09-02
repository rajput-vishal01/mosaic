"use client";

import { embedDashboard, type EmbeddedDashboard } from "@superset-ui/embedded-sdk";
import { useEffect, useRef, useState } from "react";

export function SupersetDashboard({ dashboardId, supersetDomain }: { dashboardId: string; supersetDomain: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let dashboard: EmbeddedDashboard | undefined;
    let active = true;
    const mountPoint = mountRef.current;
    if (!mountPoint) return;

    void embedDashboard({
      id: dashboardId,
      supersetDomain,
      mountPoint,
      iframeTitle: "GA4 analytics dashboard",
      referrerPolicy: "strict-origin-when-cross-origin",
      guestTokenFetchTimeoutMs: 10_000,
      fetchGuestToken: async () => {
        const response = await fetch("/api/dashboards/ga4/guest-token", { method: "POST", cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok || typeof payload !== "object" || payload === null || !("token" in payload) || typeof payload.token !== "string") {
          throw new Error("Dashboard authorization failed.");
        }
        return payload.token;
      },
      dashboardUiConfig: { hideTitle: true, filters: { expanded: false }, urlParams: { standalone: 3 } },
    }).then((embedded) => {
      dashboard = embedded;
      if (active) setState("ready");
      else embedded.unmount();
    }).catch(() => {
      if (active) setState("error");
    });

    return () => {
      active = false;
      dashboard?.unmount();
    };
  }, [dashboardId, supersetDomain]);

  return (
    <div className="relative min-h-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {state === "loading" && <div className="absolute inset-0 z-10 grid content-start gap-4 bg-white p-6" aria-label="Loading analytics dashboard"><div className="h-7 w-48 animate-pulse rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded-lg bg-slate-100" key={item} />)}</div><div className="h-80 animate-pulse rounded-lg bg-slate-100" /></div>}
      {state === "error" && <div className="absolute inset-0 z-10 grid place-items-center bg-white p-6 text-center"><div><h2 className="font-semibold text-slate-950">Dashboard unavailable</h2><p className="mt-2 text-sm text-slate-500">Mosaic could not authorize the analytics dashboard. Try reloading or contact the platform operator.</p></div></div>}
      <div className="min-h-[640px] [&>iframe]:min-h-[640px] [&>iframe]:w-full" ref={mountRef} />
    </div>
  );
}
