"use client";

import { useActionState } from "react";
import { createAgencyUser, type AgencyActionState } from "../actions";

export function UserForm({ agencyId }: { agencyId: string }) {
  const [state, action, pending] = useActionState(createAgencyUser, {} as AgencyActionState);
  return <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"><input name="agencyId" type="hidden" value={agencyId} /><label className="text-sm font-medium text-slate-700">Full name<input className="field mt-1.5" name="name" required /></label><label className="text-sm font-medium text-slate-700">Email<input className="field mt-1.5" name="email" type="email" required /></label><label className="text-sm font-medium text-slate-700">Temporary password<input className="field mt-1.5" minLength={12} name="password" type="password" required /></label><label className="text-sm font-medium text-slate-700">Agency role<select className="field mt-1.5" defaultValue="member" name="agencyRole"><option value="member">Client user</option><option value="admin">Agency admin</option></select></label><div className="flex items-center gap-4 md:col-span-2"><button className="button-primary w-auto px-5" disabled={pending} type="submit">{pending ? "Creating…" : "Create user"}</button>{(state.error || state.success) && <p className={`text-sm ${state.error ? "text-red-600" : "text-emerald-700"}`} role="status">{state.error ?? state.success}</p>}</div></form>;
}
