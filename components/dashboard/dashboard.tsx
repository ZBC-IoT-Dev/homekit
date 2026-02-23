"use client";

import { Id } from "@/convex/_generated/dataModel";
import { TomlDashboard } from "./toml-dashboard";

type DashboardHome = {
  _id: Id<"homes">;
  name: string;
};

export function Dashboard({ home }: { home: DashboardHome }) {
  return <TomlDashboard home={home} />;
}
