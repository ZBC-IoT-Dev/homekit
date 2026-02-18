"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Loader2, Thermometer, Droplets } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface DeviceOption {
  id: Id<"devices">;
  name: string;
  type: string;
}

interface TemperatureChartProps {
  devices: DeviceOption[];
}

export function TemperatureChart({ devices }: TemperatureChartProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    devices.length > 0 ? devices[0].id : "",
  );
  const [metric, setMetric] = useState<"temp" | "humid">("temp");

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  // Default to temp if device is only temp, or humidity if only humidity
  // Ideally we check what the device supports, but for now we let user toggle

  const history = useQuery(
    api.measurements.getHistory,
    selectedDeviceId
      ? {
          deviceId: selectedDeviceId as Id<"devices">,
          type: metric,
          duration: 24 * 60 * 60 * 1000,
        }
      : "skip",
  );

  const data = useMemo(() => {
    return (
      history?.map((item) => ({
        time: item.timestamp,
        value: item.value,
      })) || []
    );
  }, [history]);

  const chartConfig = {
    value: {
      label: metric === "temp" ? "Temperatur (°C)" : "Luftfugtighed (%)",
      color: metric === "temp" ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))",
    },
  };

  if (devices.length === 0) {
    return (
      <Card className="col-span-2 h-full min-h-[350px]">
        <CardHeader>
          <CardTitle>Klima Historik</CardTitle>
          <CardDescription>Ingen sensorer fundet</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <p className="text-muted-foreground">
            Tilføj en temperatursensor for at se data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2 h-full min-h-[350px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            {metric === "temp" ? "Temperatur Udvikling" : "Luftfugtighed"}
          </CardTitle>
          <CardDescription>Sidste 24 timer</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={metric}
            onValueChange={(v: "temp" | "humid") => setMetric(v)}
          >
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temp">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-3 h-3" />
                  <span>Temp</span>
                </div>
              </SelectItem>
              <SelectItem value="humid">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3 h-3" />
                  <span>Fugt</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Vælg enhed" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {history === undefined ? (
          <div className="flex h-[250px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center border border-dashed rounded-md bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Ingen data for denne periode
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-value)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-value)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.4}
              />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  return format(new Date(value), "HH:mm", { locale: da });
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={30}
                domain={["auto", "auto"]}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return format(new Date(value), "d. MMM HH:mm", {
                        locale: da,
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="value"
                type="monotone"
                fill="url(#fillValue)"
                fillOpacity={0.4}
                stroke="var(--color-value)"
                strokeWidth={2}
                animationDuration={1000}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
