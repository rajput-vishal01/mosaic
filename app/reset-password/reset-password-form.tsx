"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "@/lib/auth/client";

const schema = z.object({ password: z.string().min(12, "Use at least 12 characters."), confirmation: z.string() }).refine((value) => value.password === value.confirmation, { path: ["confirmation"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  async function submit(values: Values) {
    const result = await authClient.resetPassword({ newPassword: values.password, token });
    if (result.error) return setFormError("This reset link is invalid or has expired.");
    router.replace("/login?reset=success");
  }
  return <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><label className="block text-sm font-medium text-slate-700">New password<input className="field mt-1.5" autoComplete="new-password" type="password" {...register("password")} />{errors.password && <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>}</label><label className="block text-sm font-medium text-slate-700">Confirm password<input className="field mt-1.5" autoComplete="new-password" type="password" {...register("confirmation")} />{errors.confirmation && <span className="mt-1 block text-xs text-red-600">{errors.confirmation.message}</span>}</label>{formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}<button className="button-primary" disabled={isSubmitting} type="submit">{isSubmitting ? "Updating…" : "Update password"}</button></form>;
}
