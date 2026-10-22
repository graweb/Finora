"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Percent, WalletCards } from "lucide-react";
import { AllocationBars, SectorDonut } from "./allocation-charts";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { funds, money } from "./dashboard-data";
import { DashboardNavigation } from "./dashboard-navigation";
import { FundTable } from "./fund-table";
import { IncomeTargetForm } from "./income-target-form";
import { SimulatorSidebar } from "./simulator-sidebar";

export function FinoraDashboard() {
  const [desiredIncome, setDesiredIncome] = useState(12000);
  const income = Math.max(0, desiredIncome);
  const annualYield = funds.reduce(
    (total, fund) => total + fund.weight * fund.annualYield,
    0,
  );
  const monthlyYield = Math.pow(1 + annualYield, 1 / 12) - 1;
  const capital = income / monthlyYield;
  const sectors = useMemo(
    () =>
      Object.entries(
        funds.reduce<Record<string, number>>(
          (result, fund) => ({
            ...result,
            [fund.sector]: (result[fund.sector] || 0) + fund.weight,
          }),
          {},
        ),
      ).sort((a, b) => b[1] - a[1]),
    [],
  );

  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="dashboard" />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:pl-19.5">
        <section className="min-w-0 p-5 sm:p-7 lg:p-8">
          <IncomeTargetForm value={income} onChange={setDesiredIncome} />
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
              value={money.format(capital)}
              hint="para atingir a meta"
            />
            <DashboardMetricCard
              icon={Percent}
              label="Yield da carteira"
              value={
                (annualYield * 100).toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                }) + "% a.a."
              }
              hint={
                (monthlyYield * 100).toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                }) + "% ao mês"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <AllocationBars funds={funds} capital={capital} />
            <SectorDonut sectors={sectors} />
          </div>
          <div className="mt-4">
            <FundTable capital={capital} />
          </div>
        </section>
        <SimulatorSidebar capital={capital} income={income} />
      </div>
    </main>
  );
}
