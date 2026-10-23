"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Percent, WalletCards } from "lucide-react";
import { AllocationBars, SectorDonut } from "./allocation-charts";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { money, type Fund } from "./dashboard-types";
import { DashboardNavigation } from "./dashboard-navigation";
import { FundTable } from "./fund-table";
import { FundRecommendations } from "./fund-recommendations";
import { IncomeTargetForm } from "./income-target-form";
import { RecommendationProgress } from "./recommendation-progress";
import { toast } from "sonner";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function FinoraDashboard() {
  const [desiredIncome, setDesiredIncome] = useState(100);
  const [calculationVersion, setCalculationVersion] = useState<number | null>(null);
  const [requestedIncome, setRequestedIncome] = useState<number | null>(null);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [recommendationMetrics, setRecommendationMetrics] = useState({
    capital: 0,
    annualYield: 0,
    monthlyYield: 0,
  });
  const [recommendations, setRecommendations] = useState<
    Array<Fund & { score: number }>
  >([]);
  const [refreshingTickers, setRefreshingTickers] = useState<string[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalRefreshCount, setTotalRefreshCount] = useState(0);
  const [fundsError, setFundsError] = useState("");
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    if (calculationVersion === null || requestedIncome === null) return;

    let isMounted = true;
    const controller = new AbortController();
    const query = new URLSearchParams({
      desired_income: Math.max(0.01, requestedIncome).toFixed(2),
    });

    fetch(`${apiUrl}/investment-funds/recommendations?${query}`, {
      signal: controller.signal,
    })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Não foi possível carregar a recomendação.");
          }
          return response.json() as Promise<{
            required_capital: number | string | null;
            annual_yield: number | string | null;
            monthly_yield: number | string | null;
            refreshing_tickers: string[];
            recommendations: Array<{
              name: string;
              ticker: string;
              sector: string;
              latest_price: number | string;
              annual_dividend_yield: number | string;
              allocation_weight: number | string;
              score: number;
            }>;
          }>;
        })
        .then((data) => {
          if (!isMounted) return;
          const mappedFunds = data.recommendations.map((fund) => ({
            name: fund.name,
            ticker: fund.ticker,
            sector: fund.sector ?? "Não informado",
            referencePrice: Number(fund.latest_price),
            annualYield: Number(fund.annual_dividend_yield),
            weight: Number(fund.allocation_weight),
          }));
          setFunds(mappedFunds);
          setRecommendations(
            data.recommendations.map((fund, index) => ({
              ...mappedFunds[index],
              score: fund.score,
            })),
          );
          setRecommendationMetrics({
            capital: Number(data.required_capital ?? 0),
            annualYield: Number(data.annual_yield ?? 0),
            monthlyYield: Number(data.monthly_yield ?? 0),
          });
          setRefreshingTickers(data.refreshing_tickers);
          setTotalRefreshCount((current) =>
            Math.max(current, data.refreshing_tickers.length),
          );
          if (data.refreshing_tickers.length > 0) {
            setIsProcessing(true);
          } else {
            setIsProcessing(false);
          }
          setFundsError("");
        })
        .catch((error: Error) => {
          if (!isMounted || error.name === "AbortError") return;
          setFundsError("Não foi possível carregar os fundos cadastrados.");
          setIsProcessing(false);
        });
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [calculationVersion, refreshVersion, requestedIncome]);

  useEffect(() => {
    if (!isProcessing || refreshingTickers.length === 0) return;

    const timer = window.setTimeout(() => {
      setRefreshVersion((version) => version + 1);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isProcessing, refreshingTickers]);

  const handleCalculate = () => {
    setRequestedIncome(Math.max(0, desiredIncome));
    setRefreshingTickers([]);
    setTotalRefreshCount(0);
    setIsProcessing(false);
    setFundsError("");
    setCalculationVersion((version) => (version ?? 0) + 1);
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const response = await fetch(`${apiUrl}/investment-funds/cache`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Não foi possível limpar o cache.");
      }
      const data = (await response.json()) as { deleted_count: number };
      toast.success("Cache limpo", {
        description: `${data.deleted_count} registro(s) removido(s) do Redis.`,
      });
    } catch {
      toast.error("Não foi possível limpar o cache dos FIIs.");
    } finally {
      setIsClearingCache(false);
    }
  };

  const income = Math.max(0, desiredIncome);
  const portfolioFunds = useMemo(() => funds, [funds]);
  const isPortfolioReady =
    portfolioFunds.length > 0 &&
    portfolioFunds.every(
      (fund) => fund.referencePrice > 0 && fund.annualYield > 0,
    );
  const annualYield = recommendationMetrics.annualYield;
  const monthlyYield = recommendationMetrics.monthlyYield;
  const capital = isPortfolioReady ? recommendationMetrics.capital : 0;
  const sectors = useMemo(
    () =>
      Object.entries(
        portfolioFunds.reduce<Record<string, number>>(
          (result, fund) => ({
            ...result,
            [fund.sector]: (result[fund.sector] || 0) + fund.weight,
          }),
          {},
        ),
      ).sort((a, b) => b[1] - a[1]),
    [portfolioFunds],
  );
  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="dashboard" />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:pl-19.5">
        <section className="min-w-0 p-5 pt-20 sm:p-7 sm:pt-20 lg:p-8">
          <IncomeTargetForm
            value={income}
            onChange={setDesiredIncome}
            onCalculate={handleCalculate}
            onClearCache={handleClearCache}
            isClearingCache={isClearingCache}
          />
          {fundsError ? (
            <p className="mt-4 text-sm text-red-200">{fundsError}</p>
          ) : null}
          {calculationVersion !== null &&
          !fundsError &&
          !isPortfolioReady ? (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Para calcular a carteira, cadastre preço e DY em pelo menos um FII.
              Os melhores fundos são selecionados pela rentabilidade, diversidade
              por setor e dados atualizados.
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <DashboardMetricCard
              icon={CircleDollarSign}
              label="Renda desejada"
              value={money.format(income)}
              hint="por mês"
            />
            <DashboardMetricCard
              icon={WalletCards}
              label="Capital necessário"
              value={isPortfolioReady ? money.format(capital) : "—"}
              hint="para atingir a meta"
            />
            <DashboardMetricCard
              icon={Percent}
              label="Yield da carteira"
              value={
                isPortfolioReady
                  ? (annualYield * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    }) + "% a.a."
                  : "—"
              }
              hint={
                isPortfolioReady
                  ? (monthlyYield * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    }) + "% ao mês"
                  : "complete os dados"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            {isPortfolioReady ? (
              <AllocationBars funds={portfolioFunds} capital={capital} />
            ) : null}
            {isPortfolioReady ? <SectorDonut sectors={sectors} /> : null}
          </div>
          <div className="mt-4">
            <FundTable capital={capital} funds={portfolioFunds} />
          </div>
        </section>
        <aside className="border-t border-[#343366] bg-[#242351] p-5 sm:p-7 lg:border-t-0 lg:border-l lg:p-7">
          <RecommendationProgress
            isProcessing={isProcessing}
            progress={
              isProcessing
                ? totalRefreshCount > 0
                  ? Math.min(
                      95,
                      Math.round(
                        ((totalRefreshCount - refreshingTickers.length) /
                          totalRefreshCount) *
                          100,
                      ),
                    )
                  : 15
                : calculationVersion !== null
                  ? 100
                  : 0
            }
            remainingFunds={refreshingTickers.length}
          />
          <FundRecommendations funds={recommendations} />
        </aside>
      </div>
    </main>
  );
}
