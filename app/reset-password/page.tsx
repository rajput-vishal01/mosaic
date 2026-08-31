import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; error?: string | string[] }> }) {
  const values = await searchParams;
  const token = typeof values.token === "string" ? values.token : undefined;
  const error = typeof values.error === "string" ? values.error : undefined;
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12"><section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Use a unique password with at least 12 characters.</p><div className="mt-6">{token && !error ? <ResetPasswordForm token={token} /> : <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">This reset link is invalid or has expired.</p>}</div><Link className="mt-5 block text-center text-sm font-medium text-slate-500 hover:text-slate-950" href="/login">Back to sign in</Link></section></main>;
}
