"use client";

import { useActionState } from "react";

import { triggerGa4Synchronization, type TriggerSyncState } from "./actions";

const initialState: TriggerSyncState = { status: "idle" };

export function ConnectionSyncForm({ authorizationId }: { authorizationId: string }) {
  const [state, action, pending] = useActionState(triggerGa4Synchronization, initialState);

  return (
    <div className="flex flex-col items-start sm:items-end">
      <form action={action}>
        <input name="authorizationId" type="hidden" value={authorizationId} />
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:text-slate-400" disabled={pending} type="submit">
          {pending ? "Starting…" : "Sync now"}
        </button>
      </form>
      {state.status !== "idle" && <p className={`mt-2 max-w-56 text-xs ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`} role="status">{state.message}</p>}
    </div>
  );
}
