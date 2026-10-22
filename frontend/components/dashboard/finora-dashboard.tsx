"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Percent, WalletCards } from "lucide-react";
import { AllocationBars, SectorDonut } from "./allocation-charts";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { money, type Fund } from "./dashboard-types";
import { DashboardNavigation } from "./dashboard-navigation";
import { FundTable } from "./fund-table";
import { IncomeTargetForm } from "./income-target-form";
import { SimulatorSidebar } from "./simulator-sidebar";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function FinoraDashboard() {
  const [desiredIncome, setDesiredIncome] = useState(12000);
  const [funds, setFunds] = useState<Omit<Fund, "weight">[]>([]);
  const [isLoadingFunds, setIsLoadingFunds] = useState(true);
  const [fundsError, setFundsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetch(`${apiUrl}/investment-funds?limit=100`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar a carteira.");
        return response.json() as Promise<{
          items: Array<{
            name: string;
            ticker: string;
            sector: string | null;
            latest_price: number | string | null;
            annual_dividend_yield: number | string | null;
          }>;
        }>;
      })
      .then((data) => {
        if (!isMounted) return;
        setFunds(
          data.items.map((fund) => ({
            name: fund.name,
            ticker: fund.ticker,
            sector: fund.sector ?? "Não informado",
            referencePrice: Number(fund.latest_price ?? 0),
            annualYield: Number(fund.annual_dividend_yield ?? 0),
          })),
        );
      })
      .catch(() => {
        if (isMounted)
          setFundsError("Não foi possível carregar os fundos cadastrados.");
      })
      .finally(() => {
        if (isMounted) setIsLoadingFunds(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);
  const income = Math.max(0, desiredIncome);
  const portfolioFunds = useMemo(
    () =>
      funds.map((fund) => ({
        ...fund,
        weight: funds.length > 0 ? 1 / funds.length : 0,
      })),
    [funds],
  );
  const isPortfolioReady =
    portfolioFunds.length > 0 &&
    portfolioFunds.every(
      (fund) => fund.referencePrice > 0 && fund.annualYield > 0,
    );
  const annualYield = portfolioFunds.reduce(
    (total, fund) => total + fund.weight * fund.annualYield,
    0,
  );
  const monthlyYield = Math.pow(1 + annualYield, 1 / 12) - 1;
  const capital = isPortfolioReady ? income / monthlyYield : 0;
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
        <section className="min-w-0 p-5 sm:p-7 lg:p-8">
          <IncomeTargetForm value={income} onChange={setDesiredIncome} />
          {isLoadingFunds ? (
            <p className="mt-4 text-sm text-zinc-400">Carregando carteira...</p>
          ) : null}
          {fundsError ? (
            <p className="mt-4 text-sm text-red-200">{fundsError}</p>
          ) : null}
          {!isLoadingFunds && !fundsError && !isPortfolioReady ? (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Para calcular a carteira, cadastre preço e DY em todos os fundos.
              A alocação é recalculada igualmente entre os FIIs disponíveis.
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
        <SimulatorSidebar
          capital={capital}
          income={income}
          funds={portfolioFunds}
        />
      </div>
    </main>
  );
}
