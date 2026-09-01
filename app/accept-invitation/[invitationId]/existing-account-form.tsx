"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient, signIn } from "@/lib/auth/client";

export function ExistingAccountForm({ email, invitationId }: { email: string; invitationId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const signedIn = await signIn.email({ email, password });
    if (signedIn.error) { setPending(false); return setError("The password is incorrect."); }
    const accepted = await authClient.organization.acceptInvitation({ invitationId });
    if (accepted.error) { setPending(false); return setError("This invitation is invalid, expired, or already used."); }
    router.replace("/dashboard"); router.refresh();
  }

  return <form className="space-y-4" onSubmit={submit}><label className="block text-sm font-medium text-slate-700">Existing account password<input className="field mt-1.5" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" type="password" required /></label>{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}<button className="button-primary" disabled={pending} type="submit">{pending ? "Joining agency…" : "Sign in and accept"}</button></form>;
}
