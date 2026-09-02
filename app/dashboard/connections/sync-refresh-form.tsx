"use client";

import { useActionState } from "react";

import { refreshSynchronizationStatus, type SyncRefreshState } from "./actions";

const initialState: SyncRefreshState = { status: "idle" };

export function SyncRefreshForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(refreshSynchronizationStatus, initialState);

  return (
    <div className="flex flex-col items-start sm:items-end">
      <form action={action}>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={!enabled || pending} type="submit">
          {pending ? "Refreshing…" : "Refresh statuses"}
        </button>
      </form>
      {state.status !== "idle" && <p className={`mt-2 text-xs ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`} role="status">{state.message}</p>}
    </div>
  );
}
