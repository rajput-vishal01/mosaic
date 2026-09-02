"use client";

import { useActionState } from "react";

import { startGa4Authorization, type Ga4SetupState } from "./actions";

const initialState: Ga4SetupState = { status: "idle" };

export function Ga4SetupForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(startGa4Authorization, initialState);

  return (
    <form action={action} className="mt-5 grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Connection name<input className="rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none transition-shadow focus:border-slate-400 focus:ring-2 focus:ring-slate-200" maxLength={80} name="label" placeholder="Main GA4 portfolio" required /></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">GA4 property IDs<textarea className="min-h-24 resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm font-normal outline-none transition-shadow focus:border-slate-400 focus:ring-2 focus:ring-slate-200" name="propertyIds" placeholder="123456789, 987654321" required /><span className="font-sans text-xs font-normal leading-5 text-slate-500">Enter numeric property IDs separated by commas or new lines. Property names will be verified after ingestion is connected.</span></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Start date <span className="font-normal text-slate-400">(optional)</span><input className="rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none transition-shadow focus:border-slate-400 focus:ring-2 focus:ring-slate-200" name="startDate" type="date" /></label>
      <div><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!enabled || pending} type="submit">{pending ? "Opening Google…" : "Authorize with Google"}</button></div>
      {!enabled && <p className="text-xs leading-5 text-slate-500">A healthy Airbyte configuration and public HTTPS Mosaic URL are required.</p>}
      {state.status === "error" && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{state.message}</p>}
    </form>
  );
}
