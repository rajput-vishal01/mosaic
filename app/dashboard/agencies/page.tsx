import Link from "next/link";

import { requireSuperadmin } from "@/lib/auth/session";
import { listAgencies } from "@/lib/agencies/queries";
import { AgencyForm } from "./agency-form";
import { setAgencyStatus } from "./actions";

export default async function AgenciesPage() {
  await requireSuperadmin();
  const agencies = await listAgencies();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-medium text-slate-500 hover:text-slate-950" href="/dashboard">← Overview</Link>
        <div className="mb-6 mt-5"><p className="text-sm font-medium text-slate-500">Platform administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Agencies</h1><p className="mt-2 text-sm text-slate-500">Create and control the agency boundaries that own users and data access.</p></div>
        <AgencyForm />
        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">All agencies</h2></div>
          {agencies.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No agencies yet.</p> : <div className="divide-y divide-slate-100">{agencies.map((agency) => {
            const status = agency.status ?? "active";
            return <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" key={agency.id}><div><div className="flex items-center gap-2"><Link className="font-medium text-slate-900 hover:underline" href={`/dashboard/agencies/${agency.id}`}>{agency.name}</Link><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{status}</span></div><p className="mt-1 text-sm text-slate-500">{agency.slug} · {agency.memberCount} {agency.memberCount === 1 ? "member" : "members"}</p></div><form action={setAgencyStatus}><input name="agencyId" type="hidden" value={agency.id} /><input name="status" type="hidden" value={status === "active" ? "suspended" : "active"} /><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="submit">{status === "active" ? "Suspend" : "Restore"}</button></form></div>;
          })}</div>}
        </section>
      </div>
    </main>
  );
}
