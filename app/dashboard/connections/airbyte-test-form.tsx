"use client";

import { useActionState } from "react";

import { testAirbyteConnection, type AirbyteTestState } from "./actions";

const initialState: AirbyteTestState = { status: "idle" };

export function AirbyteTestForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(testAirbyteConnection, initialState);

  return (
    <div>
      <form action={action}>
        <button
          className="inline-flex min-w-36 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!enabled || pending}
          type="submit"
        >
          {pending ? "Checking…" : "Test connection"}
        </button>
      </form>
      {state.status === "configuration_error" && <p className="mt-3 text-sm text-amber-700" role="status">{state.message}</p>}
      {state.status === "complete" && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${state.result.state === "healthy" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
          role="status"
        >
          {state.result.state === "healthy"
            ? `Connected to ${state.result.workspaceName}.`
            : state.result.message}
        </div>
      )}
    </div>
  );
}
