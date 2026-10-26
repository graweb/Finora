import { useMemo } from "react";
import { CirclePlus, Coins, Target, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { money, percent, sectorColors, type Fund } from "./dashboard-types";

const contributionAmount = 2000;
const contributionChartConfig = {
  percent: {
    label: "Distribuição",
    color: "#34d399",
  },
  label: {
    color: "#10101a",
  },
} satisfies ChartConfig;

type PortfolioHolding = {
  ticker: string;
  quantity: number;
  average_price: number | string;
  estimated_monthly_income: number | string;
};

type MonthlyContributionPlanProps = {
  open: boolean;
  funds: Array<Fund & { score: number }>;
  holdings: PortfolioHolding[];
  totalInvested: number;
  monthlyIncome: number;
  incomeTarget: number;
};

export function MonthlyContributionPlan({
  open,
  funds,
  holdings,
  totalInvested,
  monthlyIncome,
  incomeTarget,
}: MonthlyContributionPlanProps) {
  const plan = useMemo(() => {
    const holdingsByTicker = new Map(
      holdings.map((holding) => [holding.ticker, holding]),
    );
    const candidates = funds
      .map((fund) => {
        const holding = holdingsByTicker.get(fund.ticker);
        const invested = holding
          ? holding.quantity * Number(holding.average_price)
          : 0;
        const currentWeight = totalInvested > 0 ? invested / totalInvested : 0;
        const gap = Math.max(0, fund.weight - currentWeight);
        return { fund, currentWeight, gap };
      })
      .filter(({ fund }) => fund.referencePrice > 0)
      .sort(
        (first, second) =>
          second.gap - first.gap || second.fund.score - first.fund.score,
      )
      .slice(0, 5);
    const totalGap = candidates.reduce((total, item) => total + item.gap, 0);
    const suggestions = candidates.map((item) => {
      const budget =
        totalGap > 0
          ? contributionAmount * (item.gap / totalGap)
          : contributionAmount / Math.max(candidates.length, 1);
      const quantity = Math.max(
        1,
        Math.floor(budget / item.fund.referencePrice),
      );
      const total = quantity * item.fund.referencePrice;
      return { ...item, quantity, total };
    });
    const plannedIncome = suggestions.reduce(
      (total, item) =>
        total +
        (item.total *
          (Number.isFinite(item.fund.annualYield)
            ? item.fund.annualYield
            : 0)) /
          12,
      0,
    );
    const bySector = suggestions.reduce<Record<string, number>>(
      (result, item) => ({
        ...result,
        [item.fund.sector]: (result[item.fund.sector] ?? 0) + item.total,
      }),
      {},
    );
    const distribution = Object.entries(bySector)
      .map(([sector, amount]) => ({
        sector,
        amount,
        percent: (amount / contributionAmount) * 100,
      }))
      .sort((first, second) => second.amount - first.amount);
    const progression = Array.from({ length: 8 }, (_, index) => ({
      label: [
        "Out/26",
        "Nov/26",
        "Dez/26",
        "Jan/27",
        "Fev/27",
        "Mar/27",
        "Abr/27",
        "Mai/27",
      ][index],
      amount: monthlyIncome + plannedIncome * (index + 1),
    }));

    return { suggestions, plannedIncome, distribution, progression };
  }, [funds, holdings, monthlyIncome, totalInvested]);

  if (!open) return null;

  const projectedIncome = monthlyIncome + plan.plannedIncome;
  const goalProgress =
    incomeTarget > 0
      ? Math.min(100, (projectedIncome / incomeTarget) * 100)
      : 0;
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Aportes de outubro
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Invista {money.format(contributionAmount)} este mês para aproximar
            sua carteira da meta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Mês do aporte"
            className="h-10 rounded-lg border border-[#4a4880] bg-[#222153] px-3 text-sm text-zinc-100 outline-none"
            defaultValue="2026-10"
          >
            <option value="2026-10">Outubro 2026</option>
          </select>
          <Button
            className="h-10 bg-sky-500 text-slate-950 hover:bg-sky-400"
            onClick={() =>
              toast.info("Registre as compras na aba Minha carteira.")
            }
          >
            <CirclePlus className="size-4" /> Registrar aportes
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          icon={Coins}
          label="Aporte disponível"
          value={money.format(contributionAmount)}
          hint="planejado para este mês"
        />
        <DashboardMetricCard
          icon={TrendingUp}
          label="Renda mensal projetada"
          value={money.format(projectedIncome)}
          hint="após o aporte sugerido"
        />
        <DashboardMetricCard
          icon={Target}
          label="Meta mensal"
          value={
            incomeTarget > 0
              ? money.format(incomeTarget)
              : "Defina no planejador"
          }
          hint="renda passiva desejada"
        />
        <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
          <CardContent className="flex min-h-24.5 items-center gap-3 p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-[#2d2b62] text-sky-400">
              <TrendingUp className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-300">Progresso da meta</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {incomeTarget > 0
                  ? `${goalProgress.toFixed(1).replace(".", ",")}%`
                  : "—"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#373667]">
                <div
                  className="h-full rounded-full bg-sky-400 transition-[width]"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-[#39386a] p-5">
              <h3 className="text-lg font-semibold text-white">
                Sugestão de compras
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                Priorize os ativos abaixo da alocação ideal.
              </p>
            </div>
            {plan.suggestions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-195 text-left text-sm">
                  <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wide text-zinc-300">
                    <tr>
                      <th className="px-5 py-3">FII</th>
                      <th className="px-4 py-3">Setor</th>
                      <th className="px-4 py-3 text-right">Preço atual</th>
                      <th className="px-4 py-3 text-right">Alocação atual</th>
                      <th className="px-4 py-3 text-right">Meta</th>
                      <th className="px-4 py-3 text-right">Comprar</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.suggestions.map(
                      ({ fund, currentWeight, gap, quantity, total }) => (
                        <tr
                          className="border-t border-[#39386a] transition-colors hover:bg-[#29275c]/45"
                          key={fund.ticker}
                        >
                          <td className="px-5 py-3 font-semibold text-white">
                            {fund.ticker}
                            {gap >= 0.08 ? (
                              <span className="ml-2 rounded-full border border-rose-400/40 bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-200">
                                Prioridade
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-zinc-200">
                            {fund.sector}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-200">
                            {money.format(fund.referencePrice)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-200">
                            {percent(currentWeight)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-200">
                            {percent(fund.weight)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-200">
                            {quantity} cota{quantity === 1 ? "" : "s"}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-white">
                            {money.format(total)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-12 text-center text-sm text-zinc-400">
                Calcule uma carteira sugerida no Planejador de renda para gerar
                os aportes.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-lg font-semibold text-white">
                Como o aporte será distribuído
              </CardTitle>
              <CardDescription className="text-sm text-zinc-400">
                Sugestão de distribuição para o aporte de outubro.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              {plan.distribution.length > 0 ? (
                <ChartContainer
                  className="h-52 w-full"
                  config={contributionChartConfig}
                >
                  <BarChart
                    accessibilityLayer
                    data={plan.distribution}
                    layout="vertical"
                    margin={{ right: 44 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="#3a3973"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="percent"
                      tick={false}
                      tickLine={false}
                      type="number"
                    />
                    <YAxis
                      axisLine={false}
                      dataKey="sector"
                      hide
                      tickLine={false}
                      type="category"
                      width={0}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          valueFormatter={(value) =>
                            `${Number(value).toFixed(1).replace(".", ",")}%`
                          }
                        />
                      }
                    />
                    <Bar
                      barSize={30}
                      dataKey="percent"
                      fill="var(--color-percent)"
                      radius={4}
                    >
                      {plan.distribution.map((item) => (
                        <Cell
                          fill={sectorColors[item.sector] ?? "#34d399"}
                          key={item.sector}
                        />
                      ))}
                      <LabelList
                        dataKey="sector"
                        className="fill-(--color-label)"
                        fontSize={12}
                        offset={8}
                        position="insideLeft"
                      />
                      <LabelList
                        dataKey="percent"
                        className="fill-foreground"
                        fontSize={12}
                        formatter={(value) =>
                          `${Number(value).toFixed(1).replace(".", ",")}%`
                        }
                        offset={8}
                        position="right"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="mt-5 text-sm text-zinc-400">
                  Sem sugestões de aporte.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Impacto estimado
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Renda mensal estimada
                  </p>
                </div>
                <span className="rounded-full border border-[#4a4880] px-2 py-1 text-[11px] text-zinc-300">
                  Meta prevista: maio de 2027
                </span>
              </div>
              <ChartContainer
                className="mt-4 h-48 w-full"
                config={{ amount: { label: "Renda", color: "#38bdf8" } }}
              >
                <AreaChart
                  data={plan.progression}
                  margin={{ top: 8, right: 8, left: -18 }}
                >
                  <defs>
                    <linearGradient
                      id="contribution-income"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#38bdf8"
                        stopOpacity={0.35}
                      />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#3a3973"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    tickFormatter={(value) => `R$ ${Math.round(value)}`}
                    tickLine={false}
                    width={48}
                  />
                  <RechartsTooltip
                    content={
                      <ChartTooltipContent
                        valueFormatter={(value) => money.format(value)}
                      />
                    }
                  />
                  <Area
                    dataKey="amount"
                    fill="url(#contribution-income)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    type="monotone"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
