"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "cn";

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; color?: string }
>;

const ChartContext = React.createContext<ChartConfig | null>(null);

function ChartContainer({
  className,
  config,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const style = Object.fromEntries(
    Object.entries(config)
      .filter(([, value]) => value.color)
      .map(([key, value]) => [`--color-${key}`, value.color]),
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={config}>
      <div
        className={cn("flex aspect-video justify-center text-xs", className)}
        data-slot="chart"
        style={style}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

type ChartTooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    fill?: string;
    name?: string | number;
    payload?: { sector?: string; ticker?: string };
    value?: number | string;
  }>;
  hideLabel?: boolean;
  indicator?: "dot" | "line";
  valueFormatter?: (value: number, name: string) => React.ReactNode;
};

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  indicator = "dot",
  valueFormatter,
}: ChartTooltipContentProps) {
  const config = React.useContext(ChartContext);
  if (!active || !payload?.length) return null;

  const firstPayload = payload[0]?.payload as
    | { sector?: string; ticker?: string }
    | undefined;
  const tooltipLabel = label ?? firstPayload?.sector ?? firstPayload?.ticker;

  return (
    <div className="min-w-32 rounded-lg border border-[#4a4880] bg-[#181642] px-3 py-2 text-xs shadow-xl">
      {!hideLabel && tooltipLabel ? (
        <p className="mb-1 font-semibold text-white">{tooltipLabel}</p>
      ) : null}
      <div className="grid gap-1">
        {payload.map((item) => {
          const name = String(item.name ?? "Valor");
          const itemConfig = config?.[item.dataKey ?? name];
          const value = Number(item.value ?? 0);
          return (
            <div className="flex items-center justify-between gap-4" key={name}>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <i
                  className={
                    indicator === "line"
                      ? "h-0.5 w-3 rounded-full"
                      : "size-2 rounded-full"
                  }
                  style={{ background: item.color ?? item.fill ?? "#38bdf8" }}
                />
                {itemConfig?.label ?? name}
              </span>
              <span className="font-semibold text-white">
                {valueFormatter ? valueFormatter(value, name) : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartTooltip = Tooltip;

export { ChartContainer, ChartTooltip, ChartTooltipContent };
