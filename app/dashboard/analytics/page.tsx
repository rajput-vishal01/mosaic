import Link from "next/link";
import { redirect } from "next/navigation";

import { getGrantedAccountDisplay } from "@/features/account-grants/authorization";
import { isAgencyAdmin, isSuperadmin } from "@/lib/auth/roles";
import { getAgencyContext, requireSession } from "@/lib/auth/session";
import { getSupersetConfiguration, isSupersetEmbedConfigured } from "@/lib/superset/config";
import { SupersetDashboard } from "./superset-dashboard";

export default async function AnalyticsPage() {
  const session = await requireSession();
  const agency = await getAgencyContext();
  if (isSuperadmin(session.user.role) || !agency || isAgencyAdmin(agency.role)) redirect("/dashboard");

  const accounts = (await getGrantedAccountDisplay(session.user.id, agency.id)).filter((account) => account.provider === "ga4");
  const superset = getSupersetConfiguration();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm font-medium text-slate-500 hover:text-slate-950" href="/dashboard">← Overview</Link>
        <div className="mb-6 mt-5"><p className="text-sm font-medium text-slate-500">{agency.name}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Google Analytics overview</h1><p className="mt-2 text-sm text-slate-500">Scoped to the GA4 properties currently assigned to your Mosaic account.</p></div>
        {accounts.length === 0 ? <section className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"><h2 className="font-semibold text-slate-950">No GA4 accounts assigned</h2><p className="mt-2 text-sm text-slate-500">Ask your agency administrator to assign a GA4 property.</p></section> : superset.state !== "ready" || !isSupersetEmbedConfigured() ? <section className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-12 text-center"><h2 className="font-semibold text-amber-950">Analytics service setup in progress</h2><p className="mt-2 text-sm text-amber-800">Your account access is ready, but the embedded dashboard service is not configured in this environment.</p></section> : <SupersetDashboard dashboardId={superset.configuration.ga4DashboardId} supersetDomain={superset.configuration.url} />}
      </div>
    </main>
  );
}
