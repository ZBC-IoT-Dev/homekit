"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
  GripVertical,
  Lightbulb,
  LightbulbOff,
  Thermometer,
  Droplets,
  Activity,
  Power,
} from "lucide-react";
import { sendHubWebSocketCommand } from "@/lib/hub-websocket";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const STORAGE_KEY_PREFIX = "toml_dashboard_layout_v1";

type DashboardHome = {
  _id: Id<"homes">;
  name: string;
};

type DashboardDevice = {
  _id: Id<"devices">;
  identifier: string;
  type: string;
  status: "pending" | "paired";
  isOnline: boolean;
  name?: string;
  lastSeen: number;
  data?: unknown;
};

type DashboardCard = {
  id: string;
  toml: string;
};

type CardType = "grid" | "toggle" | "sensor" | "chart";
type ItemType = "toggle" | "sensor" | "chart";

type TomlCard = {
  card: {
    title: string;
    subtitle?: string;
    type: CardType;
    col_span: number;
    row_span: number;
  };
  items: Array<{
    type: ItemType;
    device?: string;
    device_id?: string;
    label?: string;
    field?: string;
    unit?: string;
    metric?: string;
    duration_hours?: number;
    on_action?: string;
    off_action?: string;
  }>;
};

type ParseResult = { ok: true; data: TomlCard } | { ok: false; error: string };

const EMPTY_CARD_TEMPLATE = `[card]\ntitle = "Nyt Kort"\nsubtitle = "Rediger med TOML"\ntype = "grid"\ncol_span = 3\nrow_span = 2\n\n[[item]]\ntype = "toggle"\ndevice_id = "stue_lampe_id"\nlabel = "Stue"\non_action = "light_fx_on"\noff_action = "light_fx_off"\n\n[[item]]\ntype = "sensor"\ndevice_id = "stue_sensor_id"\nfield = "temp"\nlabel = "Temperatur"\nunit = "°C"\n`;

const DEFAULT_CARDS: DashboardCard[] = [];

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseTomlValue(raw: string): string | number | boolean | string[] {
  const value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === "true") return true;
  if (value === "false") return false;

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    const inside = value.slice(1, -1).trim();
    if (!inside) return [];
    return inside
      .split(",")
      .map((part) => part.trim())
      .map((part) => {
        if (
          (part.startsWith('"') && part.endsWith('"')) ||
          (part.startsWith("'") && part.endsWith("'"))
        ) {
          return part.slice(1, -1);
        }
        return part;
      });
  }

  return value;
}

function ensureInteger(input: unknown, fallback: number) {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
}

function parseCardToml(toml: string): ParseResult {
  const root: {
    card: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
  } = {
    card: {},
    items: [],
  };

  let section: "card" | "item" = "card";

  const lines = toml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const originalLine = lines[i] ?? "";
    const line = originalLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const arraySectionMatch = line.match(/^\[\[(\w+)\]\]$/);
    if (arraySectionMatch) {
      const sectionName = arraySectionMatch[1]?.toLowerCase();
      if (sectionName !== "item" && sectionName !== "items") {
        return {
          ok: false,
          error: `Linje ${i + 1}: Ukendt array-sektion [[${sectionName}]]`,
        };
      }
      root.items.push({});
      section = "item";
      continue;
    }

    const sectionMatch = line.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1]?.toLowerCase();
      if (
        sectionName !== "card" &&
        sectionName !== "toggle" &&
        sectionName !== "sensor" &&
        sectionName !== "chart"
      ) {
        return {
          ok: false,
          error: `Linje ${i + 1}: Ukendt sektion [${sectionName}]`,
        };
      }
      if (sectionName !== "card") {
        root.items.push({ type: sectionName });
        section = "item";
      } else {
        section = "card";
      }
      continue;
    }

    const assignment = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (!assignment) {
      return { ok: false, error: `Linje ${i + 1}: Forventede key = value` };
    }

    const key = assignment[1];
    const value = parseTomlValue(assignment[2] ?? "");

    if (section === "item") {
      if (root.items.length === 0) {
        root.items.push({});
      }
      root.items[root.items.length - 1]![key] = value;
      continue;
    }

    if (section === "card") {
      root.card[key] = value;
    }
  }

  const type = String(root.card.type ?? "grid").toLowerCase() as CardType;
  if (!["grid", "toggle", "sensor", "chart"].includes(type)) {
    return {
      ok: false,
      error: "[card].type skal være grid, toggle, sensor eller chart",
    };
  }

  const parsed: TomlCard = {
    card: {
      title: String(root.card.title ?? "Nyt kort"),
      subtitle: root.card.subtitle ? String(root.card.subtitle) : undefined,
      type,
      col_span: ensureInteger(root.card.col_span, 3),
      row_span: ensureInteger(root.card.row_span, 2),
    },
    items: root.items.map((item) => ({
      type: String(item.type ?? "sensor").toLowerCase() as ItemType,
      device: item.device ? String(item.device) : undefined,
      device_id: item.device_id ? String(item.device_id) : undefined,
      label: item.label ? String(item.label) : undefined,
      field: item.field ? String(item.field) : undefined,
      unit: item.unit ? String(item.unit) : undefined,
      metric: item.metric ? String(item.metric) : undefined,
      duration_hours: ensureInteger(item.duration_hours, 24),
      on_action: item.on_action ? String(item.on_action) : undefined,
      off_action: item.off_action ? String(item.off_action) : undefined,
    })),
  };

  if (parsed.card.type === "grid") {
    if (parsed.items.length === 0) {
      return {
        ok: false,
        error: "Grid-kort kræver mindst ét item eller sektion",
      };
    }
  } else {
    const hasItem = parsed.items.some(
      (i) => i.type === parsed.card.type && (i.device_id || i.device),
    );
    if (!hasItem) {
      return {
        ok: false,
        error: `${parsed.card.type}-kort kræver mindst én [${parsed.card.type}] sektion med device_id (eller device)`,
      };
    }
  }

  return { ok: true, data: parsed };
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function findDevice(devices: DashboardDevice[], query?: string) {
  if (!query) return null;
  const wanted = normalize(query);
  const byIdentifier = devices.find(
    (device) => normalize(device.identifier) === wanted,
  );
  if (byIdentifier) return byIdentifier;

  const byName = devices.find(
    (device) => normalize(device.name ?? "") === wanted,
  );
  if (byName) return byName;

  return null;
}

function readBooleanState(device: DashboardDevice): boolean {
  const data = device.data as Record<string, unknown> | undefined;
  if (!data) return false;
  const value = data.state ?? data.isOn ?? data.value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    return ["on", "true", "active", "1"].includes(value.toLowerCase());
  }
  return false;
}

function readSensorValue(device: DashboardDevice, field = "temp"): string {
  const data = device.data as Record<string, unknown> | undefined;
  if (!data) return "—";

  const wanted = normalize(field);
  const found = Object.entries(data).find(([key]) => normalize(key) === wanted);
  if (found) {
    return String(found[1] ?? "—");
  }

  return "—";
}

function resolveColSpan(colSpan: number) {
  return Math.min(Math.max(colSpan, 1), 7);
}

function resolveColClass(colSpan: number) {
  const value = resolveColSpan(colSpan);
  const map: Record<number, string> = {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
    5: "lg:col-span-5",
    6: "lg:col-span-6",
    7: "lg:col-span-7",
  };
  return map[value];
}

function resolveRowClass(rowSpan: number) {
  const value = Math.min(Math.max(rowSpan, 1), 6);
  const map: Record<number, string> = {
    1: "row-span-1",
    2: "row-span-2",
    3: "row-span-3",
    4: "row-span-4",
    5: "row-span-5",
    6: "row-span-6",
  };
  return map[value];
}

function TomlChartPanel({
  device,
  metric,
  durationHours,
}: {
  device: DashboardDevice;
  metric: string;
  durationHours: number;
}) {
  const history = useQuery(api.measurements.getHistory, {
    deviceId: device._id,
    type: metric,
    duration: durationHours * 60 * 60 * 1000,
  });

  const data =
    history?.map((entry) => ({
      time: entry.timestamp,
      value: entry.value,
    })) ?? [];

  if (history === undefined) {
    return (
      <div className="flex flex-1 min-h-[150px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-1 min-h-[150px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground bg-muted/30">
        Ingen målinger endnu
      </div>
    );
  }

  return (
    <div className="flex-1 w-full mt-4 -ml-2 -mr-2 min-h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient
              id={`fill_${device._id}_${metric}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0.2}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.1} />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value) =>
              format(new Date(value), "HH:mm", { locale: da })
            }
          />
          <YAxis 
            tickLine={false} 
            axisLine={false} 
            width={36} 
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
          />
          <Tooltip
            contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-md)", backgroundColor: "hsl(var(--background))" }}
            itemStyle={{ color: "hsl(var(--foreground))", fontSize: "13px", fontWeight: 500 }}
            formatter={(value) => [`${Number(value).toFixed(1)}`, '']}
            labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "11px", marginBottom: "4px" }}
            labelFormatter={(value) =>
              format(new Date(value), "d. MMM HH:mm", { locale: da })
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="hsl(var(--chart-1))"
            fill={`url(#fill_${device._id}_${metric})`}
            strokeWidth={2.5}
            activeDot={{ r: 5, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DashboardTomlCard({
  parsed,
  devices,
  onEdit,
  onDelete,
  onToggle,
  onResize,
  loadingKeys,
  cardId,
}: {
  parsed: TomlCard;
  devices: DashboardDevice[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (args: {
    device: DashboardDevice;
    desiredState: boolean;
    key: string;
    onAction?: string;
    offAction?: string;
    label: string;
  }) => Promise<void>;
  onResize: (colSpan: number, rowSpan: number) => void;
  loadingKeys: Set<string>;
  cardId: string;
}) {
  const renderToggle = (
    label: string,
    deviceQuery: string | undefined,
    key: string,
    onAction?: string,
    offAction?: string,
  ) => {
    const device = findDevice(devices, deviceQuery);

    if (!device) {
      return (
        <div
          key={key}
          className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground h-[100px] flex items-center bg-muted/30"
        >
          Enhed ikke fundet: {deviceQuery || "(tom)"}
        </div>
      );
    }

    const state = readBooleanState(device);
    const isLoading = loadingKeys.has(key);

    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        key={key}
        disabled={isLoading}
        onClick={() => {
          if (!isLoading) {
            void onToggle({
              device,
              desiredState: !state,
              key,
              onAction,
              offAction,
              label: label || device.name || device.identifier,
            });
          }
        }}
        className={cn(
          "relative flex min-h-[100px] h-full flex-col justify-between overflow-hidden rounded-2xl p-4 text-left transition-colors duration-300 outline-none",
          state
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/40 text-foreground hover:bg-muted/60"
        )}
      >
        <div className="flex items-start justify-between w-full">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300",
              state ? "bg-primary-foreground/20" : "bg-background shadow-xs"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state ? (
              <Power className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <p className="font-semibold leading-none text-[15px] truncate pr-2">
            {label || device.name || device.identifier}
          </p>
          <p
            className={cn(
              "mt-1.5 text-[13px] font-medium tracking-wide",
              state ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {state ? "Tændt" : "Slukket"}
          </p>
        </div>
      </motion.button>
    );
  };

  const renderSensor = (
    label: string,
    deviceQuery: string | undefined,
    field: string | undefined,
    unit: string | undefined,
    key: string,
  ) => {
    const device = findDevice(devices, deviceQuery);
    if (!device) {
      return (
        <div
          key={key}
          className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground h-[100px] flex items-center bg-muted/30"
        >
          Enhed ikke fundet: {deviceQuery || "(tom)"}
        </div>
      );
    }

    const value = readSensorValue(device, field || "temp");
    
    const fieldName = (field || "temp").toLowerCase();
    let Icon = Activity;
    if (fieldName.includes("temp")) Icon = Thermometer;
    else if (fieldName.includes("hum") || fieldName.includes("fugt")) Icon = Droplets;

    return (
      <div key={key} className="flex min-h-[100px] h-full flex-col justify-between rounded-2xl bg-muted/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-xs">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-[13px] font-medium text-muted-foreground truncate max-w-[80px]">
            {label || field || "Sensor"}
          </p>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
        </div>
      </div>
    );
  };

  const renderChart = (
    deviceQuery: string | undefined,
    metric: string | undefined,
    durationHours: number | undefined,
  ) => {
    const device = findDevice(devices, deviceQuery);
    if (!device) {
      return (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Enhed ikke fundet: {deviceQuery || "(tom)"} (brug device_id eller
          eksakt navn)
        </div>
      );
    }

    return (
      <TomlChartPanel
        device={device}
        metric={(metric || "temp").toLowerCase()}
        durationHours={durationHours ?? 24}
      />
    );
  };

  return (
    <Card className="h-full flex flex-col group/card relative overflow-hidden transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-3 pt-5 px-5 cursor-grab active:cursor-grabbing" draggable
                onDragStart={(e) => {
                  e.preventDefault(); // allow outer container to drag
                }}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-[17px] font-semibold tracking-tight">{parsed.card.title}</CardTitle>
            {parsed.card.subtitle ? (
              <CardDescription className="text-[13px]">{parsed.card.subtitle}</CardDescription>
            ) : null}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50"
              aria-label="Træk kort"
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={onEdit}
              aria-label="Rediger kort"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              aria-label="Slet kort"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-5 flex flex-col relative min-h-0 overflow-hidden">
        {parsed.card.type === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 flex-1">
            {parsed.items.map((item, index) => {
              const key = `${cardId}:item:${index}`;
              if (item.type === "toggle") {
                return renderToggle(
                  item.label || "Toggle",
                  item.device_id || item.device,
                  key,
                  item.on_action,
                  item.off_action,
                );
              }
              if (item.type === "sensor") {
                return renderSensor(
                  item.label || "Sensor",
                  item.device_id || item.device,
                  item.field,
                  item.unit,
                  key,
                );
              }
              return (
                <div key={key}>
                  {renderChart(
                    item.device_id || item.device,
                    item.metric,
                    item.duration_hours,
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {parsed.card.type !== "grid" && parsed.items.length > 0 ? (
          <div className="flex flex-col gap-3 h-full flex-1">
            {parsed.items.map((item, index) => {
              const key = `${cardId}:item:${index}`;
              if (item.type === "toggle") {
                return renderToggle(
                  item.label || "Toggle",
                  item.device_id || item.device,
                  key,
                  item.on_action,
                  item.off_action,
                );
              }
              if (item.type === "sensor") {
                return renderSensor(
                  item.label || "Sensor",
                  item.device_id || item.device,
                  item.field,
                  item.unit,
                  key,
                );
              }
              if (item.type === "chart") {
                return (
                  <div key={key} className="flex-1 min-h-[220px]">
                    {renderChart(
                      item.device_id || item.device,
                      item.metric,
                      item.duration_hours,
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ) : null}
        <div
        className="absolute bottom-1 right-1 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const initialCol = parsed.card.col_span;
          const initialRow = parsed.card.row_span;

          const targetCard = (e.currentTarget as HTMLElement).closest(".group\\/card");
          const cellW = targetCard ? targetCard.getBoundingClientRect().width / initialCol : 120;

          const handlePointerMove = (ev: PointerEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaY = ev.clientY - startY;
            
            const colDiff = Math.round(deltaX / cellW);
            const rowDiff = Math.round(deltaY / 136);
            
            let newCol = Math.max(1, Math.min(7, initialCol + colDiff));
            let newRow = Math.max(1, Math.min(6, initialRow + rowDiff));
            
            if (newCol !== parsed.card.col_span || newRow !== parsed.card.row_span) {
               onResize(newCol, newRow);
            }
          };

          const handlePointerUp = () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
          };

          document.addEventListener("pointermove", handlePointerMove);
          document.addEventListener("pointerup", handlePointerUp);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/40 hover:text-foreground transition-colors">
           <path d="M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
           <path d="M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </CardContent>
    </Card>
  );
}

export function TomlDashboard({ home }: { home: DashboardHome }) {
  const devices = useQuery(api.gateways.getHomeDevices, { homeId: home._id });

  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editorToml, setEditorToml] = useState(EMPTY_CARD_TEMPLATE);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}:${home._id}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setCards(DEFAULT_CARDS);
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as DashboardCard[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setCards(DEFAULT_CARDS);
      } else {
        const oldDefaultIds = new Set(["default-controls", "default-chart"]);
        const containsOnlyOldDefaults =
          parsed.length > 0 &&
          parsed.every((card) => oldDefaultIds.has(card.id));
        setCards(containsOnlyOldDefaults ? [] : parsed);
      }
    } catch {
      setCards(DEFAULT_CARDS);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(cards));
  }, [cards, hydrated, storageKey]);

  const parsedCards = useMemo(
    () =>
      cards.map((card) => ({
        ...card,
        parsed: parseCardToml(card.toml),
      })),
    [cards],
  );

  const editorValidation = useMemo(
    () => parseCardToml(editorToml),
    [editorToml],
  );

  const openEditor = (cardId: string) => {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) return;
    setEditorToml(card.toml);
    setEditingCardId(cardId);
  };

  const addCard = () => {
    const card: DashboardCard = { id: createId(), toml: EMPTY_CARD_TEMPLATE };
    setCards((prev) => [...prev, card]);
    setEditorToml(card.toml);
    setEditingCardId(card.id);
  };

  const saveEditor = () => {
    if (!editingCardId) return;
    const parsed = parseCardToml(editorToml);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === editingCardId ? { ...card, toml: editorToml } : card,
      ),
    );
    toast.success("Kort opdateret");
    setEditingCardId(null);
  };

  const handleResizeCard = (cardId: string, newCol: number, newRow: number) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id === cardId) {
          let updated = card.toml;
          if (updated.match(/col_span\s*=\s*\d+/)) {
            updated = updated.replace(/col_span\s*=\s*\d+/, `col_span = ${newCol}`);
          } else {
            updated = updated.replace(/\[card\]\n?/, `[card]\ncol_span = ${newCol}\n`);
          }
          if (updated.match(/row_span\s*=\s*\d+/)) {
            updated = updated.replace(/row_span\s*=\s*\d+/, `row_span = ${newRow}`);
          } else {
            updated = updated.replace(/\[card\]\n?/, `[card]\nrow_span = ${newRow}\n`);
          }
          return { ...card, toml: updated };
        }
        return card;
      })
    );
  };

  const removeCard = (cardId: string) => {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  const reorderCards = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setCards((prev) => {
      const fromIndex = prev.findIndex((card) => card.id === fromId);
      const toIndex = prev.findIndex((card) => card.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleToggle = async ({
    device,
    desiredState,
    key,
    onAction,
    offAction,
    label,
  }: {
    device: DashboardDevice;
    desiredState: boolean;
    key: string;
    onAction?: string;
    offAction?: string;
    label: string;
  }) => {
    setLoadingKeys((prev) => new Set(prev).add(key));

    const action = desiredState
      ? onAction?.trim() || "light_fx_on"
      : offAction?.trim() || "light_fx_off";
    const state = desiredState ? "ON" : "OFF";

    try {
      const result = await sendHubWebSocketCommand({
        deviceId: device.identifier,
        action,
        command: {
          state,
          fx: state,
        },
      });
      if (result.status !== "sent") {
        throw new Error(result.error || "Command failed");
      }
      toast.success(`${label}: ${desiredState ? "Tændt" : "Slukket"}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke sende kommando",
      );
    } finally {
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (!devices || !hydrated) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 mb-2">
        <h1 className="text-3xl font-bold tracking-tight">Oversigt</h1>
        <Button onClick={addCard} className="gap-2 rounded-full shadow-sm hover:shadow-md transition-shadow">
          <Plus className="h-4 w-4" />
          Tilføj kort
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 grid-flow-row-dense" style={{ gridAutoRows: '120px' }}>
        <AnimatePresence mode="popLayout">
        {parsedCards.length === 0 ? (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="col-span-full"
          >
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm text-muted-foreground">Ingen kort endnu</p>
                <Button onClick={addCard} className="gap-2 rounded-full">
                  <Plus className="h-4 w-4" />
                  Opret første kort
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          parsedCards.map((card) => {
            if (!card.parsed.ok) {
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  key={card.id}
                  className="lg:col-span-3"
                >
                  <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
                    <CardHeader className="pb-3 pt-5 px-5">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-[17px] font-semibold tracking-tight text-destructive">Ugyldig TOML</CardTitle>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => openEditor(card.id)}
                        >
                          Ret kort
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 px-5 pb-5">
                      <div className="flex items-start gap-2 text-[13px] text-destructive/80">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="leading-snug">{card.parsed.error}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            }

            const colClass = resolveColClass(card.parsed.data.card.col_span);
            const rowClass = resolveRowClass(card.parsed.data.card.row_span);
            const isDragOver =
              dragOverCardId === card.id && draggingCardId !== card.id;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                key={card.id}
                className={`${colClass} ${rowClass} ${isDragOver ? "rounded-[1.25rem] ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                draggable
                onDragStart={() => {
                  setDraggingCardId(card.id);
                }}
                onDragEnd={() => {
                  setDraggingCardId(null);
                  setDragOverCardId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverCardId(card.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingCardId) {
                    reorderCards(draggingCardId, card.id);
                  }
                  setDraggingCardId(null);
                  setDragOverCardId(null);
                }}
              >
                <DashboardTomlCard
                  parsed={card.parsed.data}
                  devices={devices}
                  onEdit={() => openEditor(card.id)}
                  onDelete={() => removeCard(card.id)}
                  onToggle={handleToggle}
                  onResize={(col, row) => handleResizeCard(card.id, col, row)}
                  loadingKeys={loadingKeys}
                  cardId={card.id}
                />
              </motion.div>
            );
          })
        )}
        </AnimatePresence>
      </div>

      <Sheet
        open={Boolean(editingCardId)}
        onOpenChange={(open) => !open && setEditingCardId(null)}
      >
        <SheetContent side="right" className="w-[96vw] sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>TOML Kort Editor</SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
            <Textarea
              value={editorToml}
              onChange={(event) => setEditorToml(event.target.value)}
              className="h-[74vh] resize-none font-mono text-xs"
            />
          </div>

          <SheetFooter className="border-t">
            {!editorValidation.ok ? (
              <p className="mr-auto text-xs text-destructive">
                {editorValidation.error}
              </p>
            ) : null}
            <Button variant="outline" onClick={() => setEditingCardId(null)}>
              Luk
            </Button>
            <Button onClick={saveEditor}>Gem kort</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
