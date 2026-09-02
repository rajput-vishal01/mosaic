import { PlugsConnected, ShieldCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { providerLabels, type ProviderKey } from "@/features/account-grants/fixtures";
import { listConnectionSummaries } from "@/features/connections/queries";
import { getSafeAirbyteConfigurationStatus } from "@/lib/airbyte/config";
import { requireSuperadmin } from "@/lib/auth/session";
import { AirbyteTestForm } from "./airbyte-test-form";

function configurationCopy(state: ReturnType<typeof getSafeAirbyteConfigurationStatus>["state"]) {
  if (state === "ready") return { label: "Ready to test", tone: "bg-emerald-50 text-emerald-700", description: "The service endpoint, application credentials, workspace, and warehouse destination are configured." };
  if (state === "unconfigured") return { label: "Not configured", tone: "bg-slate-100 text-slate-600", description: "Airbyte is optional for fixture development and has not been configured in this environment." };
  return { label: "Needs attention", tone: "bg-amber-50 text-amber-700", description: "The Airbyte environment configuration is partial or invalid." };
}

const connectionHealthTone = {
  not_connected: "bg-slate-100 text-slate-600",
  reconnect_required: "bg-amber-50 text-amber-700",
  syncing: "bg-blue-50 text-blue-700",
  healthy: "bg-emerald-50 text-emerald-700",
  stale: "bg-amber-50 text-amber-700",
  failed: "bg-rose-50 text-rose-700",
} as const;

export default async function ConnectionsPage() {
  await requireSuperadmin();
  const [connections, airbyte] = await Promise.all([listConnectionSummaries(), Promise.resolve(getSafeAirbyteConfigurationStatus())]);
  const copy = configurationCopy(airbyte.state);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-medium text-slate-500 hover:text-slate-950" href="/dashboard">← Overview</Link>
        <div className="mb-6 mt-5">
          <p className="text-sm font-medium text-slate-500">Platform administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Connections</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Operate provider ingestion from Mosaic while Airbyte credentials and administration remain server-only.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3"><span className="grid size-10 place-items-center rounded-lg bg-slate-100"><PlugsConnected className="size-5 text-slate-700" aria-hidden /></span><div><h2 className="font-semibold text-slate-950">Airbyte service</h2><p className="mt-1 text-sm text-slate-500">Reachability, application authentication, and workspace access</p></div></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${copy.tone}`}>{copy.label}</span>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">{copy.description}</p>
            {airbyte.state === "ready" && <p className="mt-2 text-xs text-slate-500">Service origin: {airbyte.apiUrl}</p>}
            {(airbyte.state === "unconfigured" || airbyte.state === "incomplete") && <p className="mt-2 text-xs leading-5 text-slate-500">Missing: {airbyte.missing.join(", ")}</p>}
            {airbyte.state === "invalid" && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">{airbyte.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
            <div className="mt-5"><AirbyteTestForm enabled={airbyte.state === "ready"} /></div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-3"><span className="grid size-10 place-items-center rounded-lg bg-emerald-50"><ShieldCheck className="size-5 text-emerald-700" aria-hidden /></span><div><h2 className="font-semibold text-slate-950">Credential boundary</h2><p className="mt-1 text-sm text-slate-500">Operator owned</p></div></div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>Provider refresh credentials stay in Airbyte.</li>
              <li>Mosaic stores identifiers and product-safe health states only.</li>
              <li>Client users authenticate only with Mosaic and never receive provider sessions.</li>
            </ul>
            <div className="mt-5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><WarningCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><p>GA4 authorization remains disabled until this environment passes the service check.</p></div>
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-950">Authorization catalog</h2><p className="mt-1 text-sm text-slate-500">Fixture records validate account grants; they are not live provider sessions.</p></div>
          {connections.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No authorization records exist yet.</p> : <div className="divide-y divide-slate-100">{connections.map((connection) => <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between" key={connection.id}><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{providerLabels[connection.provider as ProviderKey]}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${connectionHealthTone[connection.health.state]}`}>{connection.health.label}</span></div><p className="mt-1 text-sm text-slate-500">{connection.label} · {connection.externalReference ? "Service linked" : "Fixture catalog"}</p><p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">{connection.health.message}</p></div><div className="text-sm text-slate-500 sm:text-right"><p>{connection.accountCount} {connection.accountCount === 1 ? "account" : "accounts"}</p>{connection.lastSuccessfulAt && <p className="mt-1 text-xs">Last sync {connection.lastSuccessfulAt.toLocaleString()}</p>}</div></div>)}</div>}
        </section>
      </div>
    </main>
  );
}
