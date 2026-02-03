import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";

export default async function DashboardPage() {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    redirect("/sign-in");
  }

  const home = await fetchAuthQuery(api.homes.getHome, {});

  if (!home) {
    redirect("/onboarding");
  }

  return <Dashboard home={home} />;
}
