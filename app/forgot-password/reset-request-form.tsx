"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { authClient } from "@/lib/auth/client";

const schema = z.object({ email: z.email("Enter a valid email address.") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  async function submit(values: Values) {
    await authClient.requestPasswordReset({ email: values.email, redirectTo: "/reset-password" });
    setSent(true);
  }
  if (sent) return <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-800" role="status">If that email belongs to a Mosaic user, a reset link is on its way.</p>;
  return <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><label className="block text-sm font-medium text-slate-700">Email<input className="field mt-1.5" autoComplete="email" {...register("email")} />{errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}</label><button className="button-primary" disabled={isSubmitting} type="submit">{isSubmitting ? "Sending…" : "Send reset link"}</button></form>;
}
