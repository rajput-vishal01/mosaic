"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signIn } from "@/lib/auth/client";

const schema = z.object({ email: z.email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.") });
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  async function submit(values: Values) { setFormError(undefined); const result = await signIn.email(values); if (result.error) return setFormError("The email or password is incorrect."); router.replace("/dashboard"); router.refresh(); }
  return <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><label className="block text-sm font-medium text-slate-700">Email<input className="field mt-1.5" autoComplete="email" {...register("email")} />{errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}</label><label className="block text-sm font-medium text-slate-700">Password<input className="field mt-1.5" type="password" autoComplete="current-password" {...register("password")} />{errors.password && <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>}</label><div className="text-right"><Link className="text-xs font-medium text-slate-500 hover:text-slate-950" href="/forgot-password">Forgot password?</Link></div>{formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</p>}<button className="button-primary" disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in"}</button></form>;
}
