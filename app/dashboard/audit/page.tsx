import Link from "next/link";

import { listAuditEvents } from "@/features/audit/queries";
import { auditResourceTypes, loadAuditSearchParams, serializeAuditSearchParams } from "@/features/audit/search-params";

const resourceLabels = {
  agency: "Agency",
  user: "User",
  connection: "Connection",
  source_account: "Source account",
  agency_account: "Agency account",
  account_grant: "Account grant",
  dashboard: "Dashboard",
  report: "Report",
  security: "Security",
} as const;

export default async function AuditPage({ searchParams }: PageProps<"/dashboard/audit">) {
  const filters = await loadAuditSearchParams(searchParams);
  const { events, page, total, totalPages } = await listAuditEvents(filters);
  const previousUrl = serializeAuditSearchParams("/dashboard/audit", { ...filters, page: Math.max(1, page - 1) });
  const nextUrl = serializeAuditSearchParams("/dashboard/audit", { ...filters, page: Math.min(totalPages, page + 1) });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm font-medium text-slate-500 hover:text-slate-950" href="/dashboard">← Overview</Link>
        <div className="mb-6 mt-5"><p className="text-sm font-medium text-slate-500">Platform administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Audit log</h1><p className="mt-2 text-sm text-slate-500">Security-sensitive decisions across agencies and account access.</p></div>

        <form className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_160px_auto] md:items-end" method="get">
          <label className="text-sm font-medium text-slate-700">Search<input className="field mt-1.5" defaultValue={filters.q} name="q" placeholder="Action, resource, actor, or agency" /></label>
          <label className="text-sm font-medium text-slate-700">Resource<select className="field mt-1.5" defaultValue={filters.resource ?? ""} name="resource"><option value="">All resources</option>{auditResourceTypes.map((resource) => <option key={resource} value={resource}>{resourceLabels[resource]}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Result<select className="field mt-1.5" defaultValue={filters.result ?? ""} name="result"><option value="">All results</option><option value="allowed">Allowed</option><option value="denied">Denied</option></select></label>
          <div className="flex gap-2"><button className="button-primary w-auto px-4" type="submit">Apply filters</button><Link className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" href="/dashboard/audit">Clear</Link></div>
        </form>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-500">{total} {total === 1 ? "event" : "events"}</div>
          {events.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No audit events match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Actor</th><th className="px-4 py-3 font-medium">Agency</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Resource</th><th className="px-4 py-3 font-medium">Result</th><th className="px-4 py-3 font-medium">Correlation</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{event.createdAt.toLocaleString()}</td><td className="px-4 py-3 text-slate-700">{event.actorName ?? "System"}</td><td className="px-4 py-3 text-slate-700">{event.agencyName ?? "Platform"}</td><td className="px-4 py-3 font-medium text-slate-900">{event.action}</td><td className="px-4 py-3 text-slate-500">{resourceLabels[event.resourceType]}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${event.result === "allowed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{event.result}</span></td><td className="px-4 py-3 font-mono text-xs text-slate-500">{event.correlationId.slice(0, 8)}</td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm"><p className="text-slate-500">Page {page} of {totalPages}</p><div className="flex gap-2">{page > 1 ? <Link className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50" href={previousUrl}>Previous</Link> : <span className="cursor-not-allowed rounded-lg border border-slate-100 px-3 py-2 text-slate-300">Previous</span>}{page < totalPages ? <Link className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50" href={nextUrl}>Next</Link> : <span className="cursor-not-allowed rounded-lg border border-slate-100 px-3 py-2 text-slate-300">Next</span>}</div></div>
        </section>
      </div>
    </main>
  );
}
