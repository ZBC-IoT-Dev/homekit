"use client";

import {
  ChevronsUpDown,
  Check,
  Calendar,
  Home,
  Plus,
  Settings,
  Tv,
  Thermometer,
  Lightbulb,
  Lock,
  Camera,
  Speaker,
  Monitor,
} from "lucide-react";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateHomeDialog } from "@/components/create-home-dialog";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

// Menu items.
const items = [
  {
    title: "Overview",
    url: "/",
    icon: Home,
  },
  {
    title: "Devices",
    url: "/devices",
    icon: Monitor,
  },
];

const categories = [
  {
    title: "Lights",
    url: "/category/lights",
    icon: Lightbulb,
  },
  {
    title: "Climate",
    url: "/category/climate",
    icon: Thermometer,
  },
  {
    title: "Entertainment",
    url: "/category/entertainment",
    icon: Tv,
  },
  {
    title: "Security",
    url: "/category/security",
    icon: Lock,
  },
  {
    title: "Cameras",
    url: "/category/cameras",
    icon: Camera,
  },
  {
    title: "Speakers",
    url: "/category/speakers",
    icon: Speaker,
  },
];

export function AppSidebar() {
  /* Removed legacy auth state */
  const [createHomeOpen, setCreateHomeOpen] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);

  /* Removed legacy useEffect for userId */

  const homes = useQuery(api.homes.getHomes);

  useEffect(() => {
    if (homes && homes.length > 0 && !selectedHomeId) {
      const firstHome = homes[0];
      setSelectedHomeId(firstHome._id);
      // We can persist selection if needed, but for now simple default.
    }
  }, [homes, selectedHomeId]);

  const handleHomeChange = (homeId: string) => {
    setSelectedHomeId(homeId);
    localStorage.setItem("homekit_selected_home_id", homeId);
  };

  const selectedHome =
    homes?.find((h) => h._id === selectedHomeId) || homes?.[0];

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-600 text-sidebar-primary-foreground">
                    <Home className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {selectedHome ? selectedHome.name : "Smart Home"}
                    </span>
                    <span className="truncate text-xs">
                      {!selectedHome && "No Home Selected"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Homes
                </DropdownMenuLabel>
                {homes?.map((home) => (
                  <DropdownMenuItem
                    key={home._id}
                    onClick={() => handleHomeChange(home._id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      <Home className="size-4 shrink-0" />
                    </div>
                    {home.name}
                    {selectedHome?._id === home._id && (
                      <Check className="ml-auto" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => setCreateHomeOpen(true)}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">
                    Add Home
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <a href="/settings">
                <Settings />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <CreateHomeDialog
        open={createHomeOpen}
        onOpenChange={setCreateHomeOpen}
        onHomeCreated={(id) => handleHomeChange(id)}
      />
    </Sidebar>
  );
}
