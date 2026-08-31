"use client";

import { useActionState } from "react";
import { createAgency, type AgencyActionState } from "./actions";

const initialState: AgencyActionState = {};

export function AgencyForm() {
  const [state, action, pending] = useActionState(createAgency, initialState);
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-medium text-slate-700">Agency name<input className="field mt-1.5" name="name" placeholder="Northstar Media" required /></label>
      <label className="text-sm font-medium text-slate-700">URL slug<input className="field mt-1.5" name="slug" placeholder="northstar-media" required /></label>
      <button className="button-primary sm:w-auto sm:px-5" disabled={pending} type="submit">{pending ? "Creating…" : "Create agency"}</button>
      {(state.error || state.success) && <p className={`text-sm sm:col-span-3 ${state.error ? "text-red-600" : "text-emerald-700"}`} role="status">{state.error ?? state.success}</p>}
    </form>
  );
}
