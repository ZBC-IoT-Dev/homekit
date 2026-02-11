"use client";

import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Folder,
  Home,
  Plus,
  Settings,
  Monitor,
} from "lucide-react";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateHomeDialog } from "@/components/create-home-dialog";
import { CreateCategoryDialog } from "@/components/create-category-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

const items = [
  {
    title: "Oversigt",
    url: "/",
    icon: Home,
  },
  {
    title: "Enheder",
    url: "/devices",
    icon: Monitor,
  },
];

export function AppSidebar() {
  const [createHomeOpen, setCreateHomeOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem("homekit_selected_home_id");
  });

  const homes = useQuery(api.homes.getHomes);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleHomeChange = (homeId: string) => {
    setSelectedHomeId(homeId);
    localStorage.setItem("homekit_selected_home_id", homeId);
  };

  const selectedHome =
    homes?.find((h) => h._id === selectedHomeId) || homes?.[0];
  const categories = useQuery(
    api.categories.listByHome,
    selectedHome ? { homeId: selectedHome._id } : "skip",
  );
  const selectedCategorySlug = searchParams.get("category");

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
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Home className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {selectedHome ? selectedHome.name : "Smart hjem"}
                    </span>
                    <span className="truncate text-xs">
                      {!selectedHome && "Intet hjem valgt"}
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
                  Hjem
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
                    Tilføj hjem
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
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel className="px-0">
              <div className="flex items-center justify-between w-full">
                <CollapsibleTrigger className="flex gap-2 items-center rounded-md px-2 py-1 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  Kategorier
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
                {selectedHome ? (
                  <button
                    type="button"
                    className="p-0 shrink-0 cursor-pointer"
                    title="Opret kategori"
                    aria-label="Opret kategori"
                    onClick={() => setCreateCategoryOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {categories?.map((category) => (
                    <SidebarMenuItem key={category._id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={category.name}
                        isActive={
                          pathname === "/devices" &&
                          selectedCategorySlug === category.slug
                        }
                      >
                        <Link href={`/devices?category=${category.slug}`}>
                          <Folder />
                          <span>{category.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Indstillinger"
              isActive={pathname === "/settings"}
            >
              <Link href="/settings">
                <Settings />
                <span>Indstillinger</span>
              </Link>
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
      {selectedHome ? (
        <CreateCategoryDialog
          homeId={selectedHome._id}
          open={createCategoryOpen}
          onOpenChange={setCreateCategoryOpen}
        />
      ) : null}
    </Sidebar>
  );
}
