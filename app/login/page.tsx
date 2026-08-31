import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12"><div className="w-full max-w-sm"><div className="mb-8 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">M</div><div><p className="font-semibold tracking-tight text-slate-950">Mosaic</p><p className="text-sm text-slate-500">Agency analytics workspace</p></div></div><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-6"><h1 className="text-xl font-semibold tracking-tight text-slate-950">Welcome back</h1><p className="mt-1 text-sm leading-6 text-slate-500">Sign in with the credentials your agency administrator provided.</p></div><LoginForm /></section><p className="mt-5 text-center text-xs leading-5 text-slate-400">Access is managed by your agency. Contact your administrator if you need help.</p></div></main>;
}
