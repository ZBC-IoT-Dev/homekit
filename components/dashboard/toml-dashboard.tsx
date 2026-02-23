"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Pencil, Plus, Trash2, AlertTriangle, GripVertical } from "lucide-react";
import { sendHubWebSocketCommand } from "@/lib/hub-websocket";
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
  toggle?: {
    device?: string;
    device_id?: string;
    label?: string;
    on_action?: string;
    off_action?: string;
  };
  sensor?: {
    device?: string;
    device_id?: string;
    field?: string;
    label?: string;
    unit?: string;
  };
  chart?: {
    device?: string;
    device_id?: string;
    metric?: string;
    duration_hours?: number;
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

type ParseResult =
  | { ok: true; data: TomlCard }
  | { ok: false; error: string };

const EMPTY_CARD_TEMPLATE = `[card]\ntitle = "Nyt Kort"\nsubtitle = "Rediger med TOML"\ntype = "grid"\ncol_span = 3\nrow_span = 1\n\n[[item]]\ntype = "toggle"\ndevice_id = "stue_lampe_id"\nlabel = "Stue"\non_action = "light_fx_on"\noff_action = "light_fx_off"\n\n[[item]]\ntype = "sensor"\ndevice_id = "stue_sensor_id"\nfield = "temp"\nlabel = "Temperatur"\nunit = "°C"\n`;

const DEFAULT_CARDS: DashboardCard[] = [];

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseTomlValue(raw: string): string | number | boolean | string[] {
  const value = raw.trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
        if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
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
    toggle: Record<string, unknown>;
    sensor: Record<string, unknown>;
    chart: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
  } = {
    card: {},
    toggle: {},
    sensor: {},
    chart: {},
    items: [],
  };

  let section: "card" | "toggle" | "sensor" | "chart" | "item" = "card";

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
        return { ok: false, error: `Linje ${i + 1}: Ukendt array-sektion [[${sectionName}]]` };
      }
      root.items.push({});
      section = "item";
      continue;
    }

    const sectionMatch = line.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1]?.toLowerCase();
      if (sectionName !== "card" && sectionName !== "toggle" && sectionName !== "sensor" && sectionName !== "chart") {
        return { ok: false, error: `Linje ${i + 1}: Ukendt sektion [${sectionName}]` };
      }
      section = sectionName;
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

    root[section][key] = value;
  }

  const type = String(root.card.type ?? "grid").toLowerCase() as CardType;
  if (!["grid", "toggle", "sensor", "chart"].includes(type)) {
    return { ok: false, error: "[card].type skal være grid, toggle, sensor eller chart" };
  }

  const parsed: TomlCard = {
    card: {
      title: String(root.card.title ?? "Nyt kort"),
      subtitle: root.card.subtitle ? String(root.card.subtitle) : undefined,
      type,
      col_span: ensureInteger(root.card.col_span, 3),
      row_span: ensureInteger(root.card.row_span, 1),
    },
    toggle: {
      device: root.toggle.device ? String(root.toggle.device) : undefined,
      device_id: root.toggle.device_id ? String(root.toggle.device_id) : undefined,
      label: root.toggle.label ? String(root.toggle.label) : undefined,
      on_action: root.toggle.on_action ? String(root.toggle.on_action) : undefined,
      off_action: root.toggle.off_action ? String(root.toggle.off_action) : undefined,
    },
    sensor: {
      device: root.sensor.device ? String(root.sensor.device) : undefined,
      device_id: root.sensor.device_id ? String(root.sensor.device_id) : undefined,
      field: root.sensor.field ? String(root.sensor.field) : undefined,
      label: root.sensor.label ? String(root.sensor.label) : undefined,
      unit: root.sensor.unit ? String(root.sensor.unit) : undefined,
    },
    chart: {
      device: root.chart.device ? String(root.chart.device) : undefined,
      device_id: root.chart.device_id ? String(root.chart.device_id) : undefined,
      metric: root.chart.metric ? String(root.chart.metric) : undefined,
      duration_hours: ensureInteger(root.chart.duration_hours, 24),
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
      return { ok: false, error: "Grid-kort kræver mindst ét [[item]]" };
    }
  }

  if (parsed.card.type === "toggle" && !parsed.toggle?.device_id && !parsed.toggle?.device) {
    return { ok: false, error: "Toggle-kort kræver [toggle].device_id (eller device)" };
  }

  if (parsed.card.type === "sensor" && !parsed.sensor?.device_id && !parsed.sensor?.device) {
    return { ok: false, error: "Sensor-kort kræver [sensor].device_id (eller device)" };
  }

  if (parsed.card.type === "chart" && !parsed.chart?.device_id && !parsed.chart?.device) {
    return { ok: false, error: "Chart-kort kræver [chart].device_id (eller device)" };
  }

  return { ok: true, data: parsed };
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function findDevice(devices: DashboardDevice[], query?: string) {
  if (!query) return null;
  const wanted = normalize(query);
  const byIdentifier = devices.find((device) => normalize(device.identifier) === wanted);
  if (byIdentifier) return byIdentifier;

  const byName = devices.find((device) => normalize(device.name ?? "") === wanted);
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
      <div className="flex h-[220px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Ingen målinger endnu
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`fill_${device._id}_${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.32} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(value) => format(new Date(value), "HH:mm", { locale: da })}
          />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <Tooltip
            formatter={(value) => [String(value), metric]}
            labelFormatter={(value) => format(new Date(value), "d. MMM HH:mm", { locale: da })}
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="hsl(var(--chart-2))"
            fill={`url(#fill_${device._id}_${metric})`}
            strokeWidth={2}
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
        <div key={key} className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Enhed ikke fundet: {deviceQuery || "(tom)"} (brug device_id eller eksakt navn)
        </div>
      );
    }

    const state = readBooleanState(device);
    const isLoading = loadingKeys.has(key);

    return (
      <div key={key} className="rounded-md border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{label || device.name || device.identifier}</p>
            <p className="text-xs text-muted-foreground">{device.isOnline ? "Online" : "Offline"}</p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={state}
              onCheckedChange={(next) => {
                void onToggle({
                  device,
                  desiredState: next,
                  key,
                  onAction,
                  offAction,
                  label: label || device.name || device.identifier,
                });
              }}
            />
          )}
        </div>
      </div>
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
        <div key={key} className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Enhed ikke fundet: {deviceQuery || "(tom)"} (brug device_id eller eksakt navn)
        </div>
      );
    }

    const value = readSensorValue(device, field || "temp");
    return (
      <div key={key} className="rounded-md border bg-card p-3">
        <p className="text-xs text-muted-foreground">{label || field || "Sensor"}</p>
        <p className="text-lg font-semibold tabular-nums">
          {value}
          {unit ? ` ${unit}` : ""}
        </p>
      </div>
    );
  };

  const renderChart = (deviceQuery: string | undefined, metric: string | undefined, durationHours: number | undefined) => {
    const device = findDevice(devices, deviceQuery);
    if (!device) {
      return <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Enhed ikke fundet: {deviceQuery || "(tom)"} (brug device_id eller eksakt navn)</div>;
    }

    return <TomlChartPanel device={device} metric={(metric || "temp").toLowerCase()} durationHours={durationHours ?? 24} />;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{parsed.card.title}</CardTitle>
            {parsed.card.subtitle ? <CardDescription>{parsed.card.subtitle}</CardDescription> : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{parsed.card.type}</Badge>
            <Button size="icon" variant="ghost" className="cursor-grab active:cursor-grabbing" aria-label="Træk kort">
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Rediger kort">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Slet kort">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {parsed.card.type === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {parsed.items.map((item, index) => {
              const key = `${cardId}:item:${index}`;
              if (item.type === "toggle") {
                return renderToggle(item.label || "Toggle", item.device_id || item.device, key, item.on_action, item.off_action);
              }
              if (item.type === "sensor") {
                return renderSensor(item.label || "Sensor", item.device_id || item.device, item.field, item.unit, key);
              }
              return <div key={key}>{renderChart(item.device_id || item.device, item.metric, item.duration_hours)}</div>;
            })}
          </div>
        ) : null}

        {parsed.card.type === "toggle"
          ? renderToggle(
              parsed.toggle?.label || "Toggle",
              parsed.toggle?.device_id || parsed.toggle?.device,
              `${cardId}:single-toggle`,
              parsed.toggle?.on_action,
              parsed.toggle?.off_action,
            )
          : null}

        {parsed.card.type === "sensor"
          ? renderSensor(
              parsed.sensor?.label || "Sensor",
              parsed.sensor?.device_id || parsed.sensor?.device,
              parsed.sensor?.field,
              parsed.sensor?.unit,
              `${cardId}:single-sensor`,
            )
          : null}

        {parsed.card.type === "chart"
          ? renderChart(
              parsed.chart?.device_id || parsed.chart?.device,
              parsed.chart?.metric,
              parsed.chart?.duration_hours,
            )
          : null}
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

  const editorValidation = useMemo(() => parseCardToml(editorToml), [editorToml]);

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

    setCards((prev) => prev.map((card) => (card.id === editingCardId ? { ...card, toml: editorToml } : card)));
    toast.success("Kort opdateret");
    setEditingCardId(null);
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
      ? (onAction?.trim() || "light_fx_on")
      : (offAction?.trim() || "light_fx_off");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Oversigt</h1>
        <Button onClick={addCard} className="gap-2">
          <Plus className="h-4 w-4" />
          Tilføj kort
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {parsedCards.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">Ingen kort endnu</p>
              <Button onClick={addCard} className="gap-2">
                <Plus className="h-4 w-4" />
                Opret første kort
              </Button>
            </CardContent>
          </Card>
        ) : (
          parsedCards.map((card) => {
            if (!card.parsed.ok) {
              return (
                <Card key={card.id} className="lg:col-span-3 border-destructive/50">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Ugyldig TOML</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => openEditor(card.id)}>
                        Ret kort
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      {card.parsed.error}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            const colClass = resolveColClass(card.parsed.data.card.col_span);
            const isDragOver = dragOverCardId === card.id && draggingCardId !== card.id;
            return (
              <div
                key={card.id}
                className={`${colClass} ${isDragOver ? "rounded-md ring-2 ring-primary/60" : ""}`}
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
                  loadingKeys={loadingKeys}
                  cardId={card.id}
                />
              </div>
            );
          })
        )}
      </div>

      <Sheet open={Boolean(editingCardId)} onOpenChange={(open) => !open && setEditingCardId(null)}>
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
              <p className="mr-auto text-xs text-destructive">{editorValidation.error}</p>
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
