"use client";

import { useActionState } from "react";

import { recoverGa4Connection, type RecoverConnectionState } from "./actions";

const initialState: RecoverConnectionState = { status: "idle" };

export function ConnectionRecoveryForm({ authorizationId }: { authorizationId: string }) {
  const [state, action, pending] = useActionState(recoverGa4Connection, initialState);

  return (
    <div className="flex flex-col items-start sm:items-end">
      <form action={action}>
        <input name="authorizationId" type="hidden" value={authorizationId} />
        <button className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:text-amber-400" disabled={pending} type="submit">
          {pending ? "Retrying…" : "Retry setup"}
        </button>
      </form>
      {state.status !== "idle" && <p className={`mt-2 max-w-64 text-xs ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`} role="status">{state.message}</p>}
    </div>
  );
}
