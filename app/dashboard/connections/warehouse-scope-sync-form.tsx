"use client";

import { useActionState } from "react";

import { syncWarehouseAccountScopes, type WarehouseScopeSyncState } from "./actions";

const initialState: WarehouseScopeSyncState = { status: "idle" };

export function WarehouseScopeSyncForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(syncWarehouseAccountScopes, initialState);
  return <div><form action={action}><button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={!enabled || pending} type="submit">{pending ? "Publishing…" : "Publish account scopes"}</button></form>{state.status !== "idle" && <p className={`mt-2 text-xs ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`} role="status">{state.message}</p>}</div>;
}
