import { money, type Fund } from "./dashboard-types";

export function SimulatorSidebar({
  capital,
  income,
  funds,
}: {
  capital: number;
  income: number;
  funds: Fund[];
}) {
  return (
    <aside className="border-t border-[#343366] bg-[#242351] p-5 sm:p-7 lg:border-t-0 lg:border-l lg:p-7">
      <h1 className="text-xl font-bold text-white">Simulador de renda</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Carteira de FIIs · Setembro 2026
      </p>
      <div className="mt-7 rounded-xl border border-[#3d3a72] bg-[#1e1d4b] p-5">
        <p className="text-sm text-zinc-300">Aporte recomendado</p>
        <p className="mt-2 text-3xl font-bold text-white">
          {money.format(capital)}
        </p>
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          Distribua o capital entre os {funds.length} fundos de acordo com os
          pesos da carteira para buscar uma renda estimada de{" "}
          {money.format(income)} por mês.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {funds.slice(0, 5).map((fund) => (
          <div
            key={fund.ticker}
            className="flex items-center justify-between border-b border-[#39386a] pb-3 text-sm"
          >
            <span className="font-medium text-zinc-100">{fund.ticker}</span>
            <span className="text-zinc-400">
              {money.format(
                capital *
                  fund.weight *
                  (Math.pow(1 + fund.annualYield, 1 / 12) - 1),
              )}
              /mês
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
