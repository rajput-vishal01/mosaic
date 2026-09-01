"use client";

import { useRouter } from "next/navigation";

import { signOut } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return <button className="text-xs font-medium text-slate-500 hover:text-slate-950" onClick={() => signOut({ fetchOptions: { onSuccess: () => { router.replace("/login"); router.refresh(); } } })} type="button">Sign out</button>;
}
