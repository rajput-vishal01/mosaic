import Link from "next/link";
import { ForgotPasswordForm } from "./reset-request-form";

export default function ForgotPasswordPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12"><section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-semibold tracking-tight">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Enter your Mosaic email and we will send a one-time reset link.</p><div className="mt-6"><ForgotPasswordForm /></div><Link className="mt-5 block text-center text-sm font-medium text-slate-500 hover:text-slate-950" href="/login">Back to sign in</Link></section></main>;
}
