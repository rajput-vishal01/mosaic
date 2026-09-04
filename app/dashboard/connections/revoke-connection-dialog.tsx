"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useActionState, useState } from "react";

import { revokeGa4Connection, type RevokeConnectionState } from "./actions";

const initialState: RevokeConnectionState = { status: "idle" };

export function RevokeConnectionDialog({ authorizationId, label, incomplete = false }: { authorizationId: string; label: string; incomplete?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(revokeGa4Connection, initialState);

  return <Dialog.Root onOpenChange={setOpen} open={open}><Dialog.Trigger asChild><button className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50" type="button">{incomplete ? "Remove source" : "Disconnect"}</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/35" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"><Dialog.Title className="text-lg font-semibold text-slate-950">{incomplete ? "Remove incomplete source" : `Disconnect ${label}?`}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">{incomplete ? "Mosaic will delete the credential-bearing Airbyte source and retain a revoked local record for audit and scope safety. Use a new connection name if you authorize it again later." : "Mosaic will delete the Airbyte connection and credential-bearing source. Existing warehouse data stays available but becomes stale, and all new client dashboard tokens for these accounts are denied."}</Dialog.Description><form action={action} className="mt-6"><input name="authorizationId" type="hidden" value={authorizationId} /><div className="flex justify-end gap-2"><Dialog.Close asChild><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button">Cancel</button></Dialog.Close><button className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-wait disabled:opacity-60" disabled={pending} type="submit">{pending ? "Removing…" : incomplete ? "Remove source" : "Disconnect GA4"}</button></div></form>{state.status !== "idle" && <p className={`mt-4 text-sm ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`} role="status">{state.message}</p>}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
