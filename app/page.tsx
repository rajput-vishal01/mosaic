import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  redirect((await getCurrentSession()) ? "/dashboard" : "/login");
}
