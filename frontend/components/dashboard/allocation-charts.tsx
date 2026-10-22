"use client";

import { BarChart3, PieChart } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { money, type Fund } from "./dashboard-types";

const allocationChartConfig = {
  allocation: { label: "Alocação", color: "#38bdf8" },
};

export function AllocationBars({
  funds,
  capital,
}: {
  funds: Fund[];
  capital: number;
}) {
  const data = funds.slice(0, 7).map((fund) => ({
    ticker: fund.ticker.replace("11", ""),
    allocation: fund.weight * 100,
  }));

  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <BarChart3 className="size-4 text-sky-400" />
            Alocação por FII
          </h2>
          <span className="text-xs text-zinc-400">Top posições</span>
        </div>
        <ChartContainer
          config={allocationChartConfig}
          className="mt-5 h-48 w-full"
        >
          <BarChart data={data} margin={{ top: 8, right: 4, left: -20 }}>
            <defs>
              <linearGradient id="allocation-gradient" x1="0" x2="0" y1="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#3a3973" strokeDasharray="3 3" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="ticker"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: "#a1a1aa", fontSize: 10 }}
              tickFormatter={(value) => `${value}%`}
              tickLine={false}
              width={34}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(value) =>
                    value.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    }) + "%"
                  }
                />
              }
              cursor={{ fill: "#302e67", opacity: 0.45 }}
            />
            <Bar
              dataKey="allocation"
              fill="url(#allocation-gradient)"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
        <p className="mt-3 text-xs text-zinc-400">
          Montante distribuído: <b className="text-zinc-100">{money.format(capital)}</b>
        </p>
      </CardContent>
    </Card>
  );
}

export function SectorDonut({ sectors }: { sectors: Array<[string, number]> }) {
  const data = sectors.map(([name, share], index) => ({
    sector: name,
    allocation: share * 100,
    color: `hsl(${Math.round((index * 360) / sectors.length)} 82% 62%)`,
  }));

  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <PieChart className="size-4 text-sky-400" />
          Distribuição por setor
        </h2>
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <ChartContainer
            config={Object.fromEntries(
              data.map((item) => [
                item.sector,
                { label: item.sector, color: item.color },
              ]),
            )}
            className="size-44 shrink-0"
          >
            <RechartsPieChart>
              <Tooltip
                content={
                  <ChartTooltipContent
                    valueFormatter={(value) =>
                      value.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      }) + "%"
                    }
                  />
                }
              />
              <Pie
                data={data}
                dataKey="allocation"
                innerRadius={47}
                nameKey="sector"
                outerRadius={68}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((item) => (
                  <Cell fill={item.color} key={item.sector} />
                ))}
              </Pie>
              <text
                fill="white"
                textAnchor="middle"
                x="50%"
                y="47%"
                className="text-lg font-semibold"
              >
                100%
              </text>
              <text
                fill="#a1a1aa"
                textAnchor="middle"
                x="50%"
                y="60%"
                className="text-[10px]"
              >
                carteira
              </text>
            </RechartsPieChart>
          </ChartContainer>
          <div className="min-w-0 flex-1 space-y-3 sm:pl-2">
            {data.map(({ sector, allocation, color }) => (
              <div
                className="flex items-center justify-between gap-4 text-xs"
                key={sector}
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  <i className="size-2 rounded-full" style={{ background: color }} />
                  {sector}
                </span>
                <b className="text-zinc-100">
                  {allocation.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </b>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
