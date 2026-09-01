"use client";

import { useActionState } from "react";

import { inviteAgencyUser, type AgencyActionState } from "../actions";

export function InviteForm({ agencyId }: { agencyId: string }) {
  const [state, action, pending] = useActionState(inviteAgencyUser, {} as AgencyActionState);
  return <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_180px_auto] md:items-end"><input name="agencyId" type="hidden" value={agencyId} /><label className="text-sm font-medium text-slate-700">Email address<input className="field mt-1.5" name="email" type="email" required /></label><label className="text-sm font-medium text-slate-700">Agency role<select className="field mt-1.5" defaultValue="member" name="agencyRole"><option value="member">Client user</option><option value="admin">Agency admin</option></select></label><button className="button-primary md:w-auto md:px-5" disabled={pending} type="submit">{pending ? "Sending…" : "Send invitation"}</button>{(state.error || state.success) && <p className={`text-sm md:col-span-3 ${state.error ? "text-red-600" : "text-emerald-700"}`} role="status">{state.error ?? state.success}</p>}</form>;
}
