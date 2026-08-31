import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAgencyManager } from "@/lib/auth/session";
import { getAgencyWithMembers } from "@/lib/agencies/queries";
import { removeAgencyMember, setAgencyUserStatus } from "../actions";
import { UserForm } from "./user-form";

export default async function AgencyPage({ params }: PageProps<"/dashboard/agencies/[agencyId]">) {
  const agencyId = (await params).agencyId;
  const manager = await requireAgencyManager(agencyId);
  const agency = await getAgencyWithMembers(agencyId);
  if (!agency) notFound();
  return <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8"><div className="mx-auto max-w-6xl"><Link className="text-sm font-medium text-slate-500 hover:text-slate-950" href={manager.role === "superadmin" ? "/dashboard/agencies" : "/dashboard"}>← {manager.role === "superadmin" ? "Agencies" : "Overview"}</Link><div className="mb-6 mt-5"><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{agency.name}</h1><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agency.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{agency.status}</span></div><p className="mt-2 text-sm text-slate-500">Create credentials and assign each person an agency-scoped role.</p></div><UserForm agencyId={agency.id} /><section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Users</h2></div><div className="divide-y divide-slate-100">{agency.members.map(person => <div className="flex items-center justify-between gap-4 px-5 py-4" key={person.id}><div><p className="font-medium text-slate-900">{person.name}</p><p className="mt-1 text-sm text-slate-500">{person.email} · {person.role === "admin" ? "Agency admin" : "Client user"}</p></div>{person.userId !== manager.session.user.id && <div className="flex gap-2">{manager.role === "superadmin" && <form action={setAgencyUserStatus}><input name="agencyId" type="hidden" value={agency.id} /><input name="userId" type="hidden" value={person.userId} /><input name="action" type="hidden" value={person.banned ? "restore" : "suspend"} /><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="submit">{person.banned ? "Restore" : "Suspend"}</button></form>}<form action={removeAgencyMember}><input name="agencyId" type="hidden" value={agency.id} /><input name="memberId" type="hidden" value={person.id} /><input name="userId" type="hidden" value={person.userId} /><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="submit">Remove</button></form></div>}</div>)}{agency.members.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No users assigned.</p>}</div></section></div></main>;
}
