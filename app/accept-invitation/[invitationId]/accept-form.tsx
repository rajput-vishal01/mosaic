"use client";

import Link from "next/link";
import { useActionState } from "react";

import { acceptAgencyInvitation, type AcceptInvitationState } from "./actions";

export function AcceptInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(acceptAgencyInvitation, {} as AcceptInvitationState);
  if (state.success) return <div><p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-800" role="status">Your account is ready. You can now sign in.</p><Link className="button-primary mt-4" href="/login">Continue to sign in</Link></div>;
  return <form action={action} className="space-y-4"><input name="invitationId" type="hidden" value={invitationId} /><label className="block text-sm font-medium text-slate-700">Full name<input className="field mt-1.5" name="name" autoComplete="name" required /></label><label className="block text-sm font-medium text-slate-700">Password<input className="field mt-1.5" minLength={12} name="password" autoComplete="new-password" type="password" required /></label><label className="block text-sm font-medium text-slate-700">Confirm password<input className="field mt-1.5" minLength={12} name="confirmation" autoComplete="new-password" type="password" required /></label>{state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}<button className="button-primary" disabled={pending} type="submit">{pending ? "Creating account…" : "Accept invitation"}</button></form>;
}
