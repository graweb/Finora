import { useMemo } from "react";
import { CircleDollarSign, Percent, WalletCards } from "lucide-react";
import { AllocationBars, SectorDonut } from "./allocation-charts";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { money, percent, type Fund } from "./dashboard-types";
import { FundRecommendations } from "./fund-recommendations";
import { FundTable } from "./fund-table";
import { IncomeTargetForm } from "./income-target-form";
import { RecommendationProgress } from "./recommendation-progress";

type IncomePlannerProps = {
  open: boolean;
  desiredIncome: number;
  isClearingCache: boolean;
  isProcessing: boolean;
  progress: number;
  remainingFunds: number;
  capital: number;
  annualYield: number;
  monthlyYield: number;
  funds: Fund[];
  recommendations: Array<Fund & { score: number }>;
  onChangeIncome: (value: number) => void;
  onCalculate: () => void;
  onClearCache: () => void;
};

export function IncomePlanner({
  open,
  desiredIncome,
  isClearingCache,
  isProcessing,
  progress,
  remainingFunds,
  capital,
  annualYield,
  monthlyYield,
  funds,
  recommendations,
  onChangeIncome,
  onCalculate,
  onClearCache,
}: IncomePlannerProps) {
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
      ).sort((first, second) => second[1] - first[1]),
    [funds],
  );
  const isReady = funds.length > 0 && annualYield > 0 && monthlyYield > 0;

  if (!open) return null;

  return (
    <div className="mt-5">
      <IncomeTargetForm
        isClearingCache={isClearingCache}
        value={desiredIncome}
        onCalculate={onCalculate}
        onChange={onChangeIncome}
        onClearCache={onClearCache}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <DashboardMetricCard
              icon={CircleDollarSign}
              label="Renda desejada"
              value={money.format(desiredIncome)}
              hint="por mês"
            />
            <DashboardMetricCard
              icon={WalletCards}
              label="Capital necessário"
              value={isReady ? money.format(capital) : "—"}
              hint="para atingir a meta"
            />
            <DashboardMetricCard
              icon={Percent}
              label="Yield da carteira"
              value={isReady ? `${percent(annualYield)} a.a.` : "—"}
              hint={
                isReady
                  ? `${percent(monthlyYield)} ao mês`
                  : "complete os dados"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {isReady ? (
              <AllocationBars capital={capital} funds={funds} />
            ) : null}
            {isReady ? <SectorDonut sectors={sectors} /> : null}
          </div>
          <div className="mt-4">
            <FundTable capital={capital} funds={funds} />
          </div>
        </section>
        <aside>
          <RecommendationProgress
            isProcessing={isProcessing}
            progress={progress}
            remainingFunds={remainingFunds}
          />
          <FundRecommendations funds={recommendations} />
        </aside>
      </div>
    </div>
  );
}
