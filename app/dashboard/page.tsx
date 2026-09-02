import { Buildings, ChartLineUp, PlugsConnected, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { providerLabels, type ProviderKey } from "@/features/account-grants/fixtures";
import { getCurrentUserGrantedAccounts } from "@/features/account-grants/queries";
import { isAgencyAdmin, isSuperadmin } from "@/lib/auth/roles";
import { getAgencyContext, getAgencyContexts, requireSession } from "@/lib/auth/session";
import { SignOutButton } from "./sign-out-button";

const stats = [
  { label: "Agencies", icon: Buildings },
  { label: "Client users", icon: UsersThree },
  { label: "Connections", icon: PlugsConnected },
  { label: "Dashboards", icon: ChartLineUp },
];

export default async function DashboardPage() {
  const session = await requireSession();
  const superadmin = isSuperadmin(session.user.role);
  const agency = await getAgencyContext();
  const agencies = await getAgencyContexts();
  const managedAgencies = agencies.filter((item) => isAgencyAdmin(item.role));
  const grantedAccounts = superadmin ? [] : await getCurrentUserGrantedAccounts();
  const roleLabel = superadmin ? "Superadmin" : isAgencyAdmin(agency?.role) ? "Agency admin" : "Client user";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-slate-950 text-sm font-bold text-white">M</div><span className="font-semibold tracking-tight">Mosaic</span></div>
          <div className="flex items-center gap-4 text-right"><div><p className="text-sm font-medium text-slate-800">{session.user.name}</p><p className="text-xs text-slate-500">{roleLabel}</p></div><SignOutButton /></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {agency?.status === "suspended" ? (
          <section className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-lg font-semibold text-amber-950">Agency access suspended</h1><p className="mt-2 text-sm leading-6 text-amber-800">{agency.name} is currently suspended. Contact the Mosaic administrator to restore access.</p></section>
        ) : (
          <>
            <div className="mb-8"><p className="text-sm font-medium text-slate-500">{superadmin ? "Overview" : agency?.name ?? "No agency assigned"}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{superadmin ? "Platform workspace" : "Your analytics workspace"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Agency identity and account grants are active. The GA4 ingestion and embedded dashboard path is now being connected through the internal data services.</p><div className="mt-4 flex flex-wrap gap-2">{superadmin && <><Link className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" href="/dashboard/agencies">Manage agencies</Link><Link className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/dashboard/connections">Manage connections</Link><Link className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/dashboard/audit">View audit log</Link></>}{!superadmin && agency && isAgencyAdmin(agency.role) && <Link className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" href={`/dashboard/agencies/${agency.id}`}>Manage users</Link>}</div></div>
            {!superadmin && managedAgencies.length > 1 && <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-slate-900">Your agencies</h2><p className="mt-1 text-sm text-slate-500">Choose an agency to manage its users and invitations.</p><div className="mt-3 flex flex-wrap gap-2">{managedAgencies.map((item) => <Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50" href={`/dashboard/agencies/${item.id}`} key={item.id}>{item.name}</Link>)}</div></section>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, icon: Icon }) => <section key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon className="size-5 text-slate-400" aria-hidden /></div><p className="mt-5 text-2xl font-semibold text-slate-950">—</p></section>)}</div>
            {!superadmin && !isAgencyAdmin(agency?.role) && <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Assigned accounts</h2><p className="mt-1 text-sm text-slate-500">Only these source accounts will be included in your dashboards and reports.</p></div>{grantedAccounts.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No accounts have been assigned yet.</p> : <div className="divide-y divide-slate-100">{grantedAccounts.map((account) => <div className="px-5 py-4" key={account.id}><p className="font-medium text-slate-900">{account.name}</p><p className="mt-1 text-sm text-slate-500">{providerLabels[account.provider as ProviderKey]} · {account.agencyName}</p></div>)}</div>}</section>}
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-2 w-24 rounded bg-slate-200" /><div className="mt-5 grid gap-3">{["w-full", "w-5/6", "w-2/3"].map((width) => <div key={width} className={`h-10 animate-pulse rounded-lg bg-slate-100 ${width}`} />)}</div><p className="mt-5 text-sm text-slate-500">No agency data has been configured yet.</p></section>
          </>
        )}
      </div>
    </main>
  );
}
