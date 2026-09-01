"use client";

import { useActionState } from "react";
import { updateAgency, type AgencyActionState } from "../actions";

export function AgencySettingsForm({ agency }: { agency: { id: string; name: string; slug: string } }) {
  const [state, action, pending] = useActionState(updateAgency, {} as AgencyActionState);
  return <form action={action} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><input name="agencyId" type="hidden" value={agency.id} /><label className="text-sm font-medium text-slate-700">Agency name<input className="field mt-1.5" defaultValue={agency.name} name="name" required /></label><label className="text-sm font-medium text-slate-700">URL slug<input className="field mt-1.5" defaultValue={agency.slug} name="slug" required /></label><button className="button-primary md:w-auto md:px-5" disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</button>{(state.error || state.success) && <p className={`text-sm md:col-span-3 ${state.error ? "text-red-600" : "text-emerald-700"}`} role="status">{state.error ?? state.success}</p>}</form>;
}
