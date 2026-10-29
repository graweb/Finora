"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Percent,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { money, percent, type Fund } from "./dashboard-types";
import { DashboardNavigation } from "./dashboard-navigation";
import { MonthlyContributionPlan } from "./monthly-contribution-plan";
import { PageHeader } from "./page-header";
import { IncomePlanner } from "./income-planner";
import { useSidebarTabReset } from "./sidebar-tab-reset";
import { recommendationCacheClearedEvent } from "./cache-events";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PortfolioDashboard = {
  summary: {
    monthly_income: number | string;
    income_target: number | string;
    remaining_to_target: number | string;
    total_return_percentage: number | string;
    total_return_amount: number | string;
    total_invested: number | string;
    market_value: number | string;
  };
  monthly_income_history: Array<{ label: string; amount: number | string }>;
  portfolio_history: Array<{
    label: string;
    invested_amount: number | string;
    market_value: number | string;
  }>;
  upcoming_income: Array<{
    ticker: string;
    amount: number | string;
    payment_label: string;
  }>;
  highlights: Array<{
    ticker: string;
    name: string;
    sector: string;
    current_price: number | string;
    quantity: number;
    average_price: number | string;
    result_amount: number | string;
    result_percentage: number | string;
    yield_on_cost: number | string;
    estimated_monthly_income: number | string;
  }>;
  refreshing_tickers: string[];
};

type RecommendationResponse = {
  desired_income: number | string;
  required_capital: number | string | null;
  annual_yield: number | string | null;
  monthly_yield: number | string | null;
  refreshing_tickers: string[];
  uses_portfolio: boolean;
  portfolio_monthly_income: number | string;
  recommendations: Array<{
    name: string;
    ticker: string;
    sector: string;
    latest_price: number | string;
    annual_dividend_yield: number | string;
    allocation_weight: number | string;
    score: number;
  }>;
};

const emptyDashboard: PortfolioDashboard = {
  summary: {
    monthly_income: 0,
    income_target: 0,
    remaining_to_target: 0,
    total_return_percentage: 0,
    total_return_amount: 0,
    total_invested: 0,
    market_value: 0,
  },
  monthly_income_history: [],
  portfolio_history: [],
  upcoming_income: [],
  highlights: [],
  refreshing_tickers: [],
};

const chartConfig = {
  amount: { label: "Dividendos", color: "#38bdf8" },
  invested_amount: { label: "Valor investido", color: "#38bdf8" },
  market_value: { label: "Valor atual", color: "#a78bfa" },
};

export function FinoraDashboard() {
  return <FinoraDashboardContent />;
}

function FinoraDashboardContent() {
  const [dashboard, setDashboard] =
    useState<PortfolioDashboard>(emptyDashboard);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "planner" | "contributions"
  >("portfolio");
  useSidebarTabReset(() => setActiveTab("portfolio"));
  const [desiredIncome, setDesiredIncome] = useState(100);
  const [usePortfolio, setUsePortfolio] = useState(false);
  const [portfolioMonthlyIncome, setPortfolioMonthlyIncome] = useState(0);
  const [recommendationTarget, setRecommendationTarget] = useState<
    number | null
  >(null);
  const [plannerFunds, setPlannerFunds] = useState<Fund[]>([]);
  const [recommendations, setRecommendations] = useState<
    Array<Fund & { score: number }>
  >([]);
  const [metrics, setMetrics] = useState({
    capital: 0,
    annualYield: 0,
    monthlyYield: 0,
  });
  const [refreshingTickers, setRefreshingTickers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/portfolio/dashboard`);
      if (!response.ok) throw new Error();
      setDashboard((await response.json()) as PortfolioDashboard);
    } catch {
      toast.error("Não foi possível carregar o resumo da carteira.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  const applyRecommendation = useCallback((data: RecommendationResponse) => {
    setUsePortfolio(data.uses_portfolio ?? false);
    setPortfolioMonthlyIncome(Number(data.portfolio_monthly_income ?? 0));
    setRecommendationTarget(Number(data.desired_income));
    const funds = data.recommendations.map((fund) => ({
      name: fund.name,
      ticker: fund.ticker,
      sector: fund.sector || "Não informado",
      referencePrice: Number(fund.latest_price),
      annualYield: Number(fund.annual_dividend_yield),
      weight: Number(fund.allocation_weight),
    }));
    setPlannerFunds(funds);
    setRecommendations(
      data.recommendations.map((fund, index) => ({
        ...funds[index],
        score: fund.score,
      })),
    );
    setMetrics({
      capital: Number(data.required_capital ?? 0),
      annualYield: Number(data.annual_yield ?? 0),
      monthlyYield: Number(data.monthly_yield ?? 0),
    });
    setRefreshingTickers(data.refreshing_tickers);
    setIsProcessing(data.refreshing_tickers.length > 0);
  }, []);

  const loadCachedRecommendation = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiUrl}/investment-funds/recommendations/cached`,
      );
      if (response.status === 404) return;
      if (!response.ok) throw new Error();
      const recommendation = (await response.json()) as RecommendationResponse;
      setDesiredIncome(Number(recommendation.desired_income));
      applyRecommendation(recommendation);
    } catch {
      // The planner remains available when Redis is unavailable or empty.
    }
  }, [applyRecommendation]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadDashboard(), loadCachedRecommendation()]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCachedRecommendation, loadDashboard]);

  useEffect(() => {
    const clearPlanner = () => {
      setPlannerFunds([]);
      setRecommendations([]);
      setRecommendationTarget(null);
      setRefreshingTickers([]);
      setIsProcessing(false);
      setDesiredIncome(100);
      setUsePortfolio(false);
      setPortfolioMonthlyIncome(0);
    };
    window.addEventListener(recommendationCacheClearedEvent, clearPlanner);
    return () =>
      window.removeEventListener(recommendationCacheClearedEvent, clearPlanner);
  }, []);

  useEffect(() => {
    if (dashboard.refreshing_tickers.length === 0) return;
    const timer = window.setTimeout(() => void loadDashboard(), 3000);
    return () => window.clearTimeout(timer);
  }, [dashboard.refreshing_tickers.length, loadDashboard]);

  const handleCalculate = useCallback(async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `${apiUrl}/investment-funds/recommendations?desired_income=${Math.max(0.01, desiredIncome).toFixed(2)}&use_portfolio=${usePortfolio}`,
      );
      if (!response.ok) throw new Error();
      applyRecommendation((await response.json()) as RecommendationResponse);
    } catch {
      setIsProcessing(false);
      toast.error("Não foi possível calcular a carteira sugerida.");
    }
  }, [applyRecommendation, desiredIncome, usePortfolio]);

  useEffect(() => {
    if (!isProcessing || refreshingTickers.length === 0) return;
    const timer = window.setTimeout(() => void handleCalculate(), 2500);
    return () => window.clearTimeout(timer);
  }, [handleCalculate, isProcessing, refreshingTickers.length]);

  const summary = dashboard.summary;
  const monthlyIncome = Number(summary.monthly_income);
  const incomeTarget = recommendationTarget ?? Number(summary.income_target);
  const remainingToTarget = Math.max(0, incomeTarget - monthlyIncome);
  const targetProgress =
    incomeTarget > 0 ? Math.min(100, (monthlyIncome / incomeTarget) * 100) : 0;
  const totalReturn = Number(summary.total_return_percentage);
  const incomeChartData = dashboard.monthly_income_history.map((item) => ({
    label: item.label,
    amount: Number(item.amount),
  }));
  const trendChartData = dashboard.portfolio_history.map((item) => ({
    label: item.label,
    invested_amount: Number(item.invested_amount),
    market_value: Number(item.market_value),
  }));

  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="dashboard" />
      <section className="min-h-screen p-5 pt-20 sm:p-7 sm:pt-20 lg:ml-19.5 lg:p-8">
        <div className="mx-auto max-w-360">
          <PageHeader
            title="Dashboard"
            description="Veja como sua carteira está trabalhando para a sua renda mensal."
          />

          <div className="mt-5 inline-flex rounded-lg border border-[#4a4880] bg-[#222153] p-1">
            <Button
              className={
                activeTab === "portfolio"
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "text-zinc-300 hover:bg-[#302e67] hover:text-white"
              }
              onClick={() => setActiveTab("portfolio")}
              variant={activeTab === "portfolio" ? "default" : "ghost"}
            >
              <WalletCards className="size-4" /> Visão geral
            </Button>
            <Button
              className={
                activeTab === "planner"
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "text-zinc-300 hover:bg-[#302e67] hover:text-white"
              }
              onClick={() => setActiveTab("planner")}
              variant={activeTab === "planner" ? "default" : "ghost"}
            >
              <Calculator className="size-4" /> Planejador de renda
            </Button>
            <Button
              className={
                activeTab === "contributions"
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "text-zinc-300 hover:bg-[#302e67] hover:text-white"
              }
              onClick={() => setActiveTab("contributions")}
              variant={activeTab === "contributions" ? "default" : "ghost"}
            >
              <TrendingUp className="size-4" /> Planejador de aportes
            </Button>
          </div>

          <div className={activeTab === "portfolio" ? "" : "hidden"}>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardMetricCard
                icon={CircleDollarSign}
                label="Dividendos do mês"
                value={money.format(monthlyIncome)}
                hint="estimativa com base no DY atual"
              />
              <DashboardMetricCard
                icon={TrendingUp}
                label="Meta mensal"
                value={
                  incomeTarget > 0
                    ? money.format(incomeTarget)
                    : "Defina no planejador"
                }
                hint="renda passiva desejada"
              />
              <DashboardMetricCard
                icon={Clock3}
                label="Falta para a meta"
                value={incomeTarget > 0 ? money.format(remainingToTarget) : "—"}
                hint={
                  incomeTarget > 0
                    ? `${Math.round(100 - targetProgress)}% para alcançar a meta`
                    : "simule sua renda mensal"
                }
              />
              <DashboardMetricCard
                icon={Percent}
                label="Rentabilidade total"
                value={percent(totalReturn)}
                hint={`${money.format(Number(summary.total_return_amount))} sobre o investido`}
              />
            </div>

            {dashboard.refreshing_tickers.length > 0 ? (
              <p className="mt-4 rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
                Atualizando cotações de {dashboard.refreshing_tickers.length}{" "}
                FII(s) no Funds Explorer.
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
              <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <BarChart3 className="size-4 text-sky-400" /> Dividendos do
                    mês
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Projeção mensal a partir dos FIIs em carteira.
                  </p>
                  <ChartContainer
                    config={chartConfig}
                    className="mt-4 h-56 w-full"
                  >
                    <BarChart
                      data={incomeChartData}
                      margin={{ top: 8, right: 4, left: -18 }}
                    >
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
                        tickFormatter={(value) => `R$ ${value}`}
                        tickLine={false}
                        width={52}
                      />
                      <RechartsTooltip
                        content={
                          <ChartTooltipContent
                            valueFormatter={(value) => money.format(value)}
                          />
                        }
                        cursor={{ fill: "#302e67", opacity: 0.45 }}
                      />
                      <Bar
                        dataKey="amount"
                        fill="#38bdf8"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#373667]">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-[width]"
                      style={{ width: `${targetProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">
                    <span className="text-sky-300">
                      {Math.round(targetProgress)}%
                    </span>{" "}
                    da sua meta mensal
                  </p>
                </CardContent>
              </Card>
              <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <TrendingUp className="size-4 text-violet-400" /> Evolução
                    da carteira
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Valor investido versus valor atual da carteira.
                  </p>
                  <ChartContainer
                    config={chartConfig}
                    className="mt-4 h-56 w-full"
                  >
                    <AreaChart
                      data={trendChartData}
                      margin={{ top: 8, right: 4, left: -18 }}
                    >
                      <defs>
                        <linearGradient
                          id="market-value"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#a78bfa"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#a78bfa"
                            stopOpacity={0}
                          />
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
                        tickFormatter={(value) =>
                          `R$ ${Math.round(value / 1000)} mil`
                        }
                        tickLine={false}
                        width={58}
                      />
                      <RechartsTooltip
                        content={
                          <ChartTooltipContent
                            valueFormatter={(value) => money.format(value)}
                          />
                        }
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11, color: "#d4d4d8" }}
                      />
                      <Area
                        dataKey="invested_amount"
                        fill="none"
                        name="Valor investido"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        type="monotone"
                      />
                      <Area
                        dataKey="market_value"
                        fill="url(#market-value)"
                        name="Valor atual"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <CalendarDays className="size-4 text-violet-400" /> Próximos
                    proventos
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Estimativa mensal por FII.
                  </p>
                  <div className="mt-4 divide-y divide-[#39386a]">
                    {dashboard.upcoming_income.map((income) => (
                      <div
                        className="flex items-center justify-between gap-3 py-3"
                        key={income.ticker}
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {income.ticker}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {income.payment_label}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-300">
                          {money.format(Number(income.amount))}
                        </p>
                      </div>
                    ))}
                    {dashboard.upcoming_income.length === 0 ? (
                      <p className="py-8 text-center text-sm text-zinc-400">
                        Adicione compras à sua carteira para ver os proventos.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4 border-[#36366c] bg-[#222153] py-0 shadow-none">
              <CardContent className="p-0">
                <div className="border-b border-[#39386a] p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <WalletCards className="size-4 text-sky-400" /> FIIs em
                    destaque
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Principais posições da sua carteira.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-240 text-left text-sm">
                    <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wide text-zinc-300">
                      <tr>
                        <th className="px-5 py-3">FII</th>
                        <th className="px-4 py-3">Setor</th>
                        <th className="px-4 py-3 text-right">Cotação</th>
                        <th className="px-4 py-3 text-right">Resultado</th>
                        <th className="px-4 py-3 text-right">DY sobre custo</th>
                        <th className="px-5 py-3 text-right">
                          Próximo dividendo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.highlights.map((fund) => (
                        <tr
                          className="border-t border-[#39386a] transition-colors hover:bg-[#29275c]/45"
                          key={fund.ticker}
                        >
                          <td className="px-5 py-3">
                            <p className="font-semibold text-white">
                              {fund.ticker}
                            </p>
                            <p className="text-xs text-zinc-400">{fund.name}</p>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {fund.sector}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-white">
                            {money.format(Number(fund.current_price))}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${Number(fund.result_amount) >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                          >
                            {money.format(Number(fund.result_amount))}
                            <p className="text-xs">
                              {percent(Number(fund.result_percentage))}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-200">
                            {percent(Number(fund.yield_on_cost))}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-sky-200">
                            {money.format(
                              Number(fund.estimated_monthly_income),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dashboard.highlights.length === 0 && !isLoadingDashboard ? (
                    <p className="py-12 text-center text-sm text-zinc-400">
                      Cadastre um lançamento em Minha carteira para acompanhar
                      sua rentabilidade.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
          <IncomePlanner
            open={activeTab === "planner"}
            desiredIncome={desiredIncome}
            usePortfolio={usePortfolio}
            portfolioMonthlyIncome={portfolioMonthlyIncome}
            isProcessing={isProcessing}
            progress={
              isProcessing
                ? Math.max(15, 100 - refreshingTickers.length * 10)
                : recommendations.length
                  ? 100
                  : 0
            }
            remainingFunds={refreshingTickers.length}
            capital={metrics.capital}
            annualYield={metrics.annualYield}
            monthlyYield={metrics.monthlyYield}
            funds={plannerFunds}
            recommendations={recommendations}
            onChangeIncome={setDesiredIncome}
            onUsePortfolioChange={setUsePortfolio}
            onCalculate={() => void handleCalculate()}
          />
          <MonthlyContributionPlan
            funds={recommendations}
            holdings={dashboard.highlights}
            incomeTarget={incomeTarget}
            monthlyIncome={monthlyIncome}
            open={activeTab === "contributions"}
            totalInvested={Number(summary.total_invested)}
          />
        </div>
      </section>
    </main>
  );
}
