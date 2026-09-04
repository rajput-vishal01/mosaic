import { PlugsConnected, ShieldCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { providerLabels, type ProviderKey } from "@/features/account-grants/fixtures";
import { listConnectionSummaries, listRecentSyncRuns } from "@/features/connections/queries";
import { getSafeAirbyteConfigurationStatus, isGa4OauthConfigured } from "@/lib/airbyte/config";
import { requireSuperadmin } from "@/lib/auth/session";
import { getSafeWarehouseScopeStatus } from "@/lib/warehouse/config";
import { AirbyteTestForm } from "./airbyte-test-form";
import { ConnectionRecoveryForm } from "./connection-recovery-form";
import { ConnectionSyncForm } from "./connection-sync-form";
import { Ga4SetupForm } from "./ga4-setup-form";
import { RevokeConnectionDialog } from "./revoke-connection-dialog";
import { SyncRefreshForm } from "./sync-refresh-form";
import { WarehouseScopeSyncForm } from "./warehouse-scope-sync-form";

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

const ga4ResultMessages: Record<string, { tone: string; message: string }> = {
  connected: { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", message: "GA4 was connected and its initial synchronization was requested." },
  session_expired: { tone: "border-amber-200 bg-amber-50 text-amber-800", message: "The Mosaic session expired during authorization. Start the GA4 connection again." },
  invalid_callback: { tone: "border-rose-200 bg-rose-50 text-rose-800", message: "The GA4 callback was incomplete. Start the connection again." },
  invalid_state: { tone: "border-rose-200 bg-rose-50 text-rose-800", message: "The GA4 authorization expired or was already used. Start the connection again." },
  configuration_error: { tone: "border-rose-200 bg-rose-50 text-rose-800", message: "The Airbyte configuration changed during authorization." },
  source_error: { tone: "border-rose-200 bg-rose-50 text-rose-800", message: "Airbyte could not create the GA4 source. Review the property IDs and try again." },
  registration_error: { tone: "border-rose-200 bg-rose-50 text-rose-800", message: "Mosaic could not register the GA4 source. Use a different connection name and try again." },
  source_cleanup_error: { tone: "border-rose-200 bg-rose-50 text-rose-800", message: "Mosaic could not register or remove the new GA4 source. Review the private Airbyte source catalog before trying again." },
  connection_error: { tone: "border-amber-200 bg-amber-50 text-amber-800", message: "The GA4 source exists, but its warehouse connection needs recovery." },
  warehouse_error: { tone: "border-amber-200 bg-amber-50 text-amber-800", message: "GA4 is connected, but its account scopes were not published. Retry from Warehouse account scopes before assigning clients." },
  sync_start_error: { tone: "border-amber-200 bg-amber-50 text-amber-800", message: "GA4 is connected and scheduled, but Airbyte could not start the initial synchronization immediately." },
  sync_tracking_error: { tone: "border-amber-200 bg-amber-50 text-amber-800", message: "Airbyte accepted the initial synchronization, but Mosaic could not record it yet. The background reconciler can recover its status." },
};

const syncRunTone = {
  idle: "bg-slate-100 text-slate-600",
  pending: "bg-blue-50 text-blue-700",
  running: "bg-blue-50 text-blue-700",
  succeeded: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  cancelled: "bg-amber-50 text-amber-700",
} as const;

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ ga4?: string }> }) {
  await requireSuperadmin();
  const query = await searchParams;
  const [connections, recentRuns, airbyte, warehouse] = await Promise.all([listConnectionSummaries(), listRecentSyncRuns(), Promise.resolve(getSafeAirbyteConfigurationStatus()), Promise.resolve(getSafeWarehouseScopeStatus())]);
  const copy = configurationCopy(airbyte.state);
  const linkedConnectionCount = connections.filter((connection) => Boolean(connection.airbyteConnectionId)).length;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const oauthReady = airbyte.state === "ready" && warehouse.state === "ready" && isGa4OauthConfigured() && Boolean(appUrl && URL.canParse(appUrl) && new URL(appUrl).protocol === "https:");
  const ga4Result = query.ga4 ? ga4ResultMessages[query.ga4] : undefined;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-medium text-slate-500 hover:text-slate-950" href="/dashboard">← Overview</Link>
        <div className="mb-6 mt-5">
          <p className="text-sm font-medium text-slate-500">Platform administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Connections</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Operate provider ingestion from Mosaic while Airbyte credentials and administration remain server-only.</p>
        </div>
        {ga4Result && <p className={`mb-5 rounded-lg border px-4 py-3 text-sm ${ga4Result.tone}`} role="status">{ga4Result.message}</p>}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3"><span className="grid size-10 place-items-center rounded-lg bg-slate-100"><PlugsConnected className="size-5 text-slate-700" aria-hidden /></span><div><h2 className="font-semibold text-slate-950">Airbyte service</h2><p className="mt-1 text-sm text-slate-500">Reachability, application authentication, and workspace access</p></div></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${copy.tone}`}>{copy.label}</span>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">{copy.description}</p>
            {airbyte.state === "ready" && <><p className="mt-2 text-xs text-slate-500">Service origin: {airbyte.apiUrl}</p><p className="mt-1 text-xs text-slate-500">New connections sync every {airbyte.syncFrequencyHours} {airbyte.syncFrequencyHours === 1 ? "hour" : "hours"} on an Airbyte-owned UTC schedule.</p></>}
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

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-sm font-medium text-slate-500">First live connector</p><h2 className="mt-1 font-semibold text-slate-950">Connect Google Analytics 4</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Choose the property boundary before opening Google authorization. Airbyte receives and retains the provider credentials; Mosaic retains only the resulting source and connection IDs.</p></div>
          <Ga4SetupForm enabled={oauthReady} />
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-950">Warehouse account scopes</h2><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${warehouse.state === "ready" ? "bg-emerald-50 text-emerald-700" : warehouse.state === "invalid" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{warehouse.state === "ready" ? "Ready" : warehouse.state === "invalid" ? "Needs attention" : "Not configured"}</span></div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Publish canonical provider-account mappings to the private warehouse function. The runtime identity cannot read mappings or analytics facts.</p></div><WarehouseScopeSyncForm enabled={warehouse.state === "ready"} /></div></section>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold text-slate-950">Authorization catalog</h2><p className="mt-1 text-sm text-slate-500">Fixture records validate account grants; they are not live provider sessions.</p></div><SyncRefreshForm enabled={airbyte.state === "ready" && linkedConnectionCount > 0} /></div>
          {connections.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No authorization records exist yet.</p> : <div className="divide-y divide-slate-100">{connections.map((connection) => <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between" key={connection.id}><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{providerLabels[connection.provider as ProviderKey]}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${connectionHealthTone[connection.health.state]}`}>{connection.health.label}</span></div><p className="mt-1 text-sm text-slate-500">{connection.label} · {connection.airbyteSourceId ? "Airbyte source" : "Fixture catalog"}</p><p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">{connection.health.message}</p></div><div className="flex flex-col items-start gap-3 text-sm text-slate-500 sm:items-end sm:text-right"><div><p>{connection.accountCount} {connection.accountCount === 1 ? "account" : "accounts"}</p>{connection.lastSuccessfulAt && <p className="mt-1 text-xs">Last sync {connection.lastSuccessfulAt.toLocaleString()}</p>}</div>{connection.provider === "ga4" && connection.status === "error" && connection.airbyteSourceId && !connection.airbyteConnectionId && <div className="flex flex-wrap items-start gap-2 sm:justify-end"><ConnectionRecoveryForm authorizationId={connection.id} /><RevokeConnectionDialog authorizationId={connection.id} incomplete label={connection.label} /></div>}{connection.provider === "ga4" && connection.status === "active" && connection.airbyteSourceId && connection.airbyteConnectionId && <div className="flex flex-wrap items-start gap-2 sm:justify-end"><ConnectionSyncForm authorizationId={connection.id} /><RevokeConnectionDialog authorizationId={connection.id} label={connection.label} /></div>}</div></div>)}</div>}
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Recent synchronization runs</h2>
            <p className="mt-1 text-sm text-slate-500">The latest observed Airbyte jobs, retained in Mosaic with sanitized failure summaries.</p>
          </div>
          {recentRuns.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No synchronization runs have been observed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Connection</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Started</th><th className="px-5 py-3">Duration</th><th className="px-5 py-3">Rows</th><th className="px-5 py-3">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentRuns.map((run) => (
                    <tr className="align-top" key={run.id}>
                      <td className="whitespace-nowrap px-5 py-4"><p className="font-medium text-slate-900">{run.connectionLabel}</p><p className="mt-1 text-xs text-slate-500">{providerLabels[run.provider as ProviderKey]} · Job {run.jobId}</p></td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${syncRunTone[run.status]}`}>{run.status}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{run.startedAt.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDuration(run.durationSeconds)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{run.recordsSynced?.toLocaleString() ?? "—"}</td>
                      <td className="max-w-sm px-5 py-4 text-slate-600">{run.failureSummary ?? (run.completedAt ? `Completed ${run.completedAt.toLocaleString()}` : "In progress")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
