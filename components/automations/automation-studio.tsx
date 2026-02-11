"use client";

import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Lightbulb,
  Play,
  Plus,
  Thermometer,
  Workflow,
  Zap,
} from "lucide-react";

type TriggerMetric = "temperature" | "pir";
type Comparator = ">" | ">=" | "<" | "<=";
type PirState = "on" | "off";
type ActionCommand = "turn_on" | "turn_off" | "toggle";

type DeviceLike = {
  _id: string;
  identifier: string;
  type: string;
  status: "pending" | "paired";
  name?: string;
  data?: unknown;
};

type ActionOption = {
  id: string;
  label: string;
};

type TriggerNodeData = {
  title: string;
  deviceId: string;
  deviceName: string;
  metric: TriggerMetric;
  metricOptions: TriggerMetric[];
  comparator: Comparator;
  threshold: number;
  pirState: PirState;
  noMotionDelaySeconds: number;
  onChange: (patch: Partial<Omit<TriggerNodeData, "onChange">>) => void;
};

type ActionNodeData = {
  title: string;
  command: ActionCommand;
  targetId: string;
  targetOptions: ActionOption[];
  onChange: (patch: Partial<Omit<ActionNodeData, "onChange">>) => void;
};

type TriggerNode = Node<TriggerNodeData, "triggerNode">;
type ActionNode = Node<ActionNodeData, "actionNode">;
type AutomationNode = TriggerNode | ActionNode;

type PaletteItem =
  | {
      kind: "trigger";
      deviceId: string;
      deviceName: string;
      metrics: TriggerMetric[];
    }
  | {
      kind: "action";
      targetId: string;
      targetName: string;
    };

type PersistedCanvasPayload = {
  nodes?: unknown;
  edges?: unknown;
};

type SavedAutomationRow = {
  _id: Id<"automations">;
};

const comparatorOptions: Comparator[] = [">", ">=", "<", "<="];
const actionOptions: ActionCommand[] = ["turn_on", "turn_off", "toggle"];
const noMotionDelayOptionsSeconds = [
  30,
  60,
  120,
  300,
  600,
  900,
  1800,
  3600,
  7200,
  21600,
  43200,
  86400,
];

const metricLabel: Record<TriggerMetric, string> = {
  temperature: "Temperatur",
  pir: "PIR",
};

const commandLabel: Record<ActionCommand, string> = {
  turn_on: "Tænd",
  turn_off: "Sluk",
  toggle: "Skift tilstand",
};

function isTriggerMetric(value: unknown): value is TriggerMetric {
  return value === "temperature" || value === "pir";
}

function TriggerNodeView({ data, selected }: NodeProps<TriggerNode>) {
  return (
    <div
      className={`w-72 rounded-xl border bg-card p-3 shadow-sm ${
        selected ? "ring-2 ring-primary/50" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Activity className="h-3 w-3" />
          Trigger
        </Badge>
        <p className="truncate text-sm font-semibold">{data.title}</p>
      </div>
      <p className="mb-3 truncate text-xs text-muted-foreground">
        {data.deviceName}
      </p>
      <div className="space-y-2 text-xs">
        <label className="block space-y-1">
          <span className="text-muted-foreground">Type</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={data.metric}
            onChange={(event) =>
              data.onChange({ metric: event.target.value as TriggerMetric })
            }
          >
            {data.metricOptions.map((metric) => (
              <option key={metric} value={metric}>
                {metricLabel[metric]}
              </option>
            ))}
          </select>
        </label>

        {data.metric === "pir" ? (
          <>
            <label className="block space-y-1">
              <span className="text-muted-foreground">Status</span>
              <select
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={data.pirState}
                onChange={(event) =>
                  data.onChange({ pirState: event.target.value as PirState })
                }
              >
                <option value="on">Bevægelse registreret</option>
                <option value="off">Ingen bevægelse (med timer)</option>
              </select>
            </label>
            {data.pirState === "off" ? (
              <label className="block space-y-1">
                <span className="text-muted-foreground">Varighed uden bevægelse</span>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={data.noMotionDelaySeconds}
                  onChange={(event) =>
                    data.onChange({
                      noMotionDelaySeconds: Number(event.target.value || 30),
                    })
                  }
                >
                  {noMotionDelayOptionsSeconds.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {formatDurationLabel(seconds)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Skift til "Ingen bevægelse" for at aktivere timer.
              </p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <label className="block space-y-1">
              <span className="text-muted-foreground">Operator</span>
              <select
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={data.comparator}
                onChange={(event) =>
                  data.onChange({
                    comparator: event.target.value as Comparator,
                  })
                }
              >
                {comparatorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">Værdi</span>
              <input
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                type="number"
                value={Number.isFinite(data.threshold) ? data.threshold : 0}
                onChange={(event) =>
                  data.onChange({ threshold: Number(event.target.value || 0) })
                }
              />
            </label>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function ActionNodeView({ data, selected }: NodeProps<ActionNode>) {
  return (
    <div
      className={`w-72 rounded-xl border bg-card p-3 shadow-sm ${
        selected ? "ring-2 ring-primary/50" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Zap className="h-3 w-3" />
          Action
        </Badge>
        <p className="truncate text-sm font-semibold">{data.title}</p>
      </div>
      <div className="space-y-2 text-xs">
        <label className="block space-y-1">
          <span className="text-muted-foreground">Mål-enhed</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={data.targetId}
            onChange={(event) =>
              data.onChange({ targetId: event.target.value })
            }
          >
            {data.targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-muted-foreground">Kommando</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={data.command}
            onChange={(event) =>
              data.onChange({ command: event.target.value as ActionCommand })
            }
          >
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {commandLabel[option]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  triggerNode: TriggerNodeView,
  actionNode: ActionNodeView,
};

function parseMetricKeys(data: unknown): Set<string> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return new Set();
  }
  return new Set(
    Object.keys(data as Record<string, unknown>).map((key) =>
      key.toLowerCase(),
    ),
  );
}

function hasTemperatureLikeKey(keys: Set<string>) {
  for (const key of keys) {
    if (key.includes("temp") || key.includes("celsius")) {
      return true;
    }
  }
  return false;
}

function metricIcon(metric: TriggerMetric) {
  if (metric === "temperature")
    return <Thermometer className="h-4 w-4 text-orange-500" />;
  return <Activity className="h-4 w-4 text-violet-500" />;
}

function getDeviceLabel(device: Pick<DeviceLike, "name" | "identifier">) {
  return device.name?.trim() || device.identifier;
}

function formatDurationLabel(seconds: number) {
  if (seconds < 60) return `${seconds} sekunder`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutter`;
  const hours = seconds / 3600;
  if (Number.isInteger(hours)) return `${hours} timer`;
  return `${hours.toFixed(1)} timer`;
}

function buildTriggerText(data: TriggerNodeData) {
  if (data.metric === "pir") {
    if (data.pirState === "off") {
      return `${data.deviceName}: Ingen bevægelse i ${formatDurationLabel(data.noMotionDelaySeconds)}`;
    }
    return `${data.deviceName}: PIR er ${data.pirState === "on" ? "ON" : "OFF"}`;
  }
  return `${data.deviceName}: Temperatur ${data.comparator} ${data.threshold}°C`;
}

function buildActionText(data: ActionNodeData) {
  const targetLabel =
    data.targetOptions.find((option) => option.id === data.targetId)?.label ||
    "Ukendt enhed";
  return `${commandLabel[data.command]} ${targetLabel}`;
}

function extractNodeCounter(id: string) {
  const match = id.match(/-(\d+)$/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function FlowCanvas({
  sensorPalette,
  actionPalette,
  storageKey,
  homeId,
  existingAutomations,
}: {
  sensorPalette: Array<Extract<PaletteItem, { kind: "trigger" }>>;
  actionPalette: Array<Extract<PaletteItem, { kind: "action" }>>;
  storageKey: string;
  homeId: Id<"homes">;
  existingAutomations: SavedAutomationRow[];
}) {
  const upsertAutomation = useMutation(api.automations.upsert);
  const removeAutomation = useMutation(api.automations.remove);
  const targetOptions: ActionOption[] = useMemo(
    () =>
      actionPalette.map((item) => ({
        id: item.targetId,
        label: item.targetName,
      })),
    [actionPalette],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<AutomationNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const idCounter = useRef(1);
  const hasLoadedFromStorage = useRef(false);
  const { screenToFlowPosition, getViewport } = useReactFlow();

  const updateTriggerNode = useCallback(
    (nodeId: string, patch: Partial<Omit<TriggerNodeData, "onChange">>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId || node.type !== "triggerNode") return node;
          return {
            ...node,
            data: {
              ...node.data,
              ...patch,
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const updateActionNode = useCallback(
    (nodeId: string, patch: Partial<Omit<ActionNodeData, "onChange">>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId || node.type !== "actionNode") return node;
          return {
            ...node,
            data: {
              ...node.data,
              ...patch,
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const addTriggerNode = useCallback(
    (item: Extract<PaletteItem, { kind: "trigger" }>, x: number, y: number) => {
      const nodeId = `trigger-${idCounter.current++}`;
      const defaultMetric = item.metrics[0] || "temperature";
      const node: TriggerNode = {
        id: nodeId,
        type: "triggerNode",
        position: { x, y },
        data: {
          title: "Sensor-trigger",
          deviceId: item.deviceId,
          deviceName: item.deviceName,
          metric: defaultMetric,
          metricOptions: item.metrics,
          comparator: ">",
          threshold: 20,
          pirState: defaultMetric === "pir" ? "off" : "on",
          noMotionDelaySeconds: 30,
          onChange: (patch) => updateTriggerNode(nodeId, patch),
        },
      };
      setNodes((currentNodes) => [...currentNodes, node]);
    },
    [setNodes, updateTriggerNode],
  );

  const addActionNode = useCallback(
    (item: Extract<PaletteItem, { kind: "action" }>, x: number, y: number) => {
      const nodeId = `action-${idCounter.current++}`;
      const node: ActionNode = {
        id: nodeId,
        type: "actionNode",
        position: { x, y },
        data: {
          title: "Aktuator",
          command: "turn_on",
          targetId: item.targetId,
          targetOptions,
          onChange: (patch) => updateActionNode(nodeId, patch),
        },
      };
      setNodes((currentNodes) => [...currentNodes, node]);
    },
    [setNodes, targetOptions, updateActionNode],
  );

  const hydrateNodes = useCallback(
    (rawNodes: unknown): AutomationNode[] => {
      if (!Array.isArray(rawNodes)) return [];
      let nextCounter =
        rawNodes.reduce((max, rawNode) => {
          if (!rawNode || typeof rawNode !== "object") return max;
          const rawId = String((rawNode as Record<string, unknown>).id ?? "");
          return Math.max(max, extractNodeCounter(rawId));
        }, 0) + 1;
      const seenNodeIds = new Set<string>();
      const ensureUniqueNodeId = (
        requestedId: string,
        nodeType: "triggerNode" | "actionNode",
      ) => {
        if (requestedId && !seenNodeIds.has(requestedId)) {
          seenNodeIds.add(requestedId);
          return requestedId;
        }
        const prefix = nodeType === "triggerNode" ? "trigger" : "action";
        let generatedId = `${prefix}-${nextCounter++}`;
        while (seenNodeIds.has(generatedId)) {
          generatedId = `${prefix}-${nextCounter++}`;
        }
        seenNodeIds.add(generatedId);
        return generatedId;
      };
      return rawNodes
        .map((rawNode) => {
          if (!rawNode || typeof rawNode !== "object") return null;
          const node = rawNode as Record<string, unknown>;
          const rawNodeId = String(node.id ?? "");
          const nodeType = String(node.type ?? "");
          const rawPosition = (node.position as Record<string, unknown>) || {};
          const x = Number(rawPosition.x);
          const y = Number(rawPosition.y);
          if (!rawNodeId || !Number.isFinite(x) || !Number.isFinite(y)) return null;

          if (nodeType === "triggerNode") {
            const nodeId = ensureUniqueNodeId(rawNodeId, "triggerNode");
            const data = (node.data as Record<string, unknown>) || {};
            const parsedMetricOptions: TriggerMetric[] = Array.isArray(
              data.metricOptions,
            )
              ? data.metricOptions.filter(isTriggerMetric)
              : [];
            const metricOptions: TriggerMetric[] =
              parsedMetricOptions.length > 0
                ? parsedMetricOptions
                : ["temperature"];
            const metric: TriggerMetric = isTriggerMetric(data.metric)
              ? data.metric
              : metricOptions[0] || "temperature";
            return {
              id: nodeId,
              type: "triggerNode",
              position: { x, y },
              data: {
                title: String(data.title ?? "Sensor-trigger"),
                deviceId: String(data.deviceId ?? ""),
                deviceName: String(data.deviceName ?? "Ukendt sensor"),
                metric,
                metricOptions,
                comparator: comparatorOptions.includes(
                  data.comparator as Comparator,
                )
                  ? (data.comparator as Comparator)
                  : ">",
                threshold: Number.isFinite(Number(data.threshold))
                  ? Number(data.threshold)
                  : 20,
                pirState: metric === "pir" ? (data.pirState === "on" ? "on" : "off") : "on",
                noMotionDelaySeconds: Number.isFinite(Number(data.noMotionDelaySeconds))
                  ? Math.max(30, Math.round(Number(data.noMotionDelaySeconds)))
                  : 30,
                onChange: (patch) => updateTriggerNode(nodeId, patch),
              },
            } satisfies TriggerNode;
          }

          if (nodeType === "actionNode") {
            const nodeId = ensureUniqueNodeId(rawNodeId, "actionNode");
            const data = (node.data as Record<string, unknown>) || {};
            const selectedTarget = String(data.targetId ?? "");
            const defaultTarget = targetOptions[0]?.id || "";
            return {
              id: nodeId,
              type: "actionNode",
              position: { x, y },
              data: {
                title: String(data.title ?? "Aktuator"),
                command: actionOptions.includes(data.command as ActionCommand)
                  ? (data.command as ActionCommand)
                  : "turn_on",
                targetId: selectedTarget || defaultTarget,
                targetOptions,
                onChange: (patch) => updateActionNode(nodeId, patch),
              },
            } satisfies ActionNode;
          }
          return null;
        })
        .filter((node): node is AutomationNode => Boolean(node));
    },
    [targetOptions, updateActionNode, updateTriggerNode],
  );

  useEffect(() => {
    if (typeof window === "undefined" || hasLoadedFromStorage.current) return;
    hasLoadedFromStorage.current = true;
    const payload = localStorage.getItem(`automation_flow_${storageKey}`);
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as PersistedCanvasPayload;
      const hydratedNodes = hydrateNodes(parsed.nodes);
      idCounter.current =
        hydratedNodes.reduce(
          (max, node) => Math.max(max, extractNodeCounter(node.id)),
          0,
        ) + 1;
      setNodes(hydratedNodes);
      if (Array.isArray(parsed.edges)) {
        setEdges(parsed.edges as Edge[]);
      }
    } catch {
      toast.error("Kunne ikke indlæse gemte noder");
    }
  }, [hydrateNodes, setEdges, setNodes, storageKey]);

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.type !== "actionNode") return node;
        const selectedTargetExists = targetOptions.some(
          (option) => option.id === node.data.targetId,
        );
        return {
          ...node,
          data: {
            ...node.data,
            targetId: selectedTargetExists
              ? node.data.targetId
              : (targetOptions[0]?.id ?? ""),
            targetOptions,
          },
        };
      }),
    );
  }, [setNodes, targetOptions]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedFromStorage.current) return;
    const serializableNodes = nodes.map((node) => {
      const { onChange, ...data } = node.data;
      void onChange;
      return { ...node, data };
    });
    localStorage.setItem(
      `automation_flow_${storageKey}`,
      JSON.stringify({
        nodes: serializableNodes,
        edges,
      }),
    );
  }, [edges, nodes, storageKey]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: true,
          },
          currentEdges,
        ),
      );
    },
    [setEdges],
  );

  const getCanvasInsertPosition = useCallback(
    (index: number) => {
      const viewport = getViewport();
      const baseX = window.innerWidth * 0.54 + index * 22;
      const baseY = window.innerHeight * 0.42 + index * 16;
      const flowPosition = screenToFlowPosition({ x: baseX, y: baseY });
      return {
        x: flowPosition.x - viewport.x * 0,
        y: flowPosition.y - viewport.y * 0,
      };
    },
    [getViewport, screenToFlowPosition],
  );

  const rules = useMemo(() => {
    return edges
      .map((edge) => {
        const source = nodes.find((node) => node.id === edge.source);
        const target = nodes.find((node) => node.id === edge.target);
        if (!source || !target) return null;
        if (source.type !== "triggerNode" || target.type !== "actionNode") return null;
        return {
          id: edge.id,
          triggerNode: source,
          actionNode: target,
          trigger: buildTriggerText(source.data),
          action: buildActionText(target.data),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          id: string;
          triggerNode: TriggerNode;
          actionNode: ActionNode;
          trigger: string;
          action: string;
        } => Boolean(entry),
      );
  }, [edges, nodes]);

  const saveAutomationsToBackend = useCallback(async () => {
    if (rules.length === 0) {
      toast.error("Forbind mindst én trigger til en action");
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(
        existingAutomations.map((row) =>
          removeAutomation({
            automationId: row._id,
          }),
        ),
      );

      await Promise.all(
        rules.map((rule, index) => {
          const triggerData = rule.triggerNode.data;
          const actionData = rule.actionNode.data;
          return upsertAutomation({
            homeId,
            name: `Regel ${index + 1}`,
            enabled: true,
            triggerType: triggerData.metric === "pir" ? "pir" : "temperature",
            triggerDeviceId: triggerData.deviceId as Id<"devices">,
            temperatureComparator:
              triggerData.metric === "temperature"
                ? triggerData.comparator
                : undefined,
            temperatureThreshold:
              triggerData.metric === "temperature" ? triggerData.threshold : undefined,
            pirState:
              triggerData.metric === "pir"
                ? triggerData.pirState === "on"
                  ? "motion"
                  : "no_motion"
                : undefined,
            pirNoMotionDelaySeconds:
              triggerData.metric === "pir" && triggerData.pirState === "off"
                ? Math.max(30, Math.round(triggerData.noMotionDelaySeconds))
                : undefined,
            trueTargetDeviceId: actionData.targetId as Id<"devices">,
            trueCommand: actionData.command,
            falseTargetDeviceId: undefined,
            falseCommand: undefined,
          });
        }),
      );

      toast.success("Automations gemt og aktive");
      setIsSheetOpen(false);
    } catch {
      toast.error("Kunne ikke gemme automations");
    } finally {
      setIsSaving(false);
    }
  }, [existingAutomations, homeId, removeAutomation, rules, upsertAutomation]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute left-3 top-3 z-20">
        <Badge variant="secondary" className="gap-2">
          <Workflow className="h-3.5 w-3.5" />
          React Flow builder
        </Badge>
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <Badge variant="outline">{rules.length} regler</Badge>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Tilføj node
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Tilføj noder</SheetTitle>
              <SheetDescription>
                Byg flows for PIR og temperatur. Vil du have if/else, så lav to regler
                med modsat betingelse.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 overflow-y-auto px-4 pb-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Trigger noder
                </p>
                <div className="space-y-2">
                  {sensorPalette.map((item, index) => (
                    <button
                      key={`${item.deviceId}-sheet-trigger`}
                      type="button"
                      onClick={() => {
                        const { x, y } = getCanvasInsertPosition(index);
                        addTriggerNode(item, x, y);
                        setIsSheetOpen(false);
                      }}
                      className="w-full rounded-lg border bg-muted/30 p-2 text-left transition hover:border-primary/50 hover:bg-muted"
                    >
                      <p className="truncate text-sm font-medium">
                        {item.deviceName}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.metrics.map((metric) => (
                          <Badge
                            variant="outline"
                            key={metric}
                            className="gap-1 text-[10px]"
                          >
                            {metricIcon(metric)}
                            {metricLabel[metric]}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                  {sensorPalette.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Ingen PIR/temperatur-enheder fundet.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Action noder
                </p>
                <div className="space-y-2">
                  {actionPalette.map((item, index) => (
                    <button
                      key={`${item.targetId}-sheet-action`}
                      type="button"
                      onClick={() => {
                        const { x, y } = getCanvasInsertPosition(index + 2);
                        addActionNode(item, x, y);
                        setIsSheetOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-2 text-left transition hover:border-primary/50 hover:bg-muted"
                    >
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      <span className="truncate text-sm font-medium">
                        {item.targetName}
                      </span>
                    </button>
                  ))}
                  {actionPalette.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Ingen lys/switch enheder fundet.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNodes([]);
                      setEdges([]);
                      setIsSheetOpen(false);
                    }}
                  >
                    Ryd canvas
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveAutomationsToBackend()}
                    disabled={rules.length === 0 || isSaving}
                  >
                    {isSaving ? "Gemmer..." : "Gem automations"}
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aktive regler i canvas
                </p>
                {rules.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Forbind en trigger-node til en action-node.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rules.map((rule, index) => (
                      <div key={rule.id} className="rounded-lg border p-3">
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Regel {index + 1}
                        </p>
                        <p className="flex items-center gap-2 text-sm">
                          <Play className="h-3.5 w-3.5 text-primary" />
                          {rule.trigger}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          {rule.action}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <ReactFlow
        className="h-full w-full bg-muted/20"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap zoomable pannable />
        <Controls />
        <Background gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}

export function AutomationStudio() {
  const home = useQuery(api.homes.getHome);
  const devices = useQuery(
    api.gateways.getHomeDevices,
    home ? { homeId: home._id } : "skip",
  );
  const existingAutomations = useQuery(
    api.automations.list,
    home ? { homeId: home._id } : "skip",
  ) as SavedAutomationRow[] | undefined;

  const pairedDevices = useMemo(
    () =>
      (devices || []).filter(
        (device) => device.status === "paired",
      ) as DeviceLike[],
    [devices],
  );

  const sensorPalette = useMemo(() => {
    return pairedDevices
      .map((device) => {
        const metrics: TriggerMetric[] = [];
        const normalizedType = device.type.toLowerCase();
        const keys = parseMetricKeys(device.data);
        const normalizedLabel = getDeviceLabel(device).toLowerCase();
        const isMotionLikeDevice =
          normalizedType.includes("pir") ||
          normalizedType.includes("motion") ||
          normalizedLabel.includes("pir") ||
          normalizedLabel.includes("motion") ||
          keys.has("motion") ||
          keys.has("occupancy");
        const isActuatorLike =
          normalizedType.includes("power") ||
          normalizedType.includes("light") ||
          normalizedType.includes("switch") ||
          normalizedType.includes("relay") ||
          normalizedType.includes("onoff");

        if (
          normalizedType.includes("temp") ||
          normalizedType.includes("climate") ||
          keys.has("temp") ||
          keys.has("temperature") ||
          hasTemperatureLikeKey(keys)
        ) {
          metrics.push("temperature");
        }
        if (
          isMotionLikeDevice ||
          (!isActuatorLike && (keys.has("ison") || keys.has("state")))
        ) {
          metrics.push("pir");
        }

        if (metrics.length === 0) {
          return null;
        }

        return {
          kind: "trigger" as const,
          deviceId: device._id,
          deviceName: getDeviceLabel(device),
          metrics: Array.from(new Set(metrics)),
        };
      })
      .filter((item): item is Extract<PaletteItem, { kind: "trigger" }> =>
        Boolean(item),
      );
  }, [pairedDevices]);

  const actionPalette = useMemo(() => {
    return pairedDevices
      .filter((device) => {
        const normalizedType = device.type.toLowerCase();
        const keys = parseMetricKeys(device.data);
        const normalizedLabel = getDeviceLabel(device).toLowerCase();
        const looksLikeMotionSensor =
          normalizedType.includes("pir") ||
          normalizedType.includes("motion") ||
          normalizedLabel.includes("pir") ||
          normalizedLabel.includes("motion") ||
          keys.has("motion") ||
          keys.has("occupancy");
        const looksLikeActuator =
          normalizedType.includes("power") ||
          normalizedType.includes("light") ||
          normalizedType.includes("switch") ||
          normalizedType.includes("relay") ||
          normalizedType.includes("onoff");
        return looksLikeActuator && !looksLikeMotionSensor;
      })
      .map((device) => ({
        kind: "action" as const,
        targetId: device._id,
        targetName: getDeviceLabel(device),
      }));
  }, [pairedDevices]);

  if (!home) {
    return <div className="flex min-h-[calc(100vh-10rem)] flex-1" />;
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-1 flex-col">
      <ReactFlowProvider>
        <FlowCanvas
          sensorPalette={sensorPalette}
          actionPalette={actionPalette}
          storageKey={home._id}
          homeId={home._id}
          existingAutomations={existingAutomations || []}
        />
      </ReactFlowProvider>
    </div>
  );
}
