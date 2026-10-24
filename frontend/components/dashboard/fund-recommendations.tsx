import { Sparkles } from "lucide-react";
import type { Fund } from "./dashboard-types";

export type RecommendedFund = Fund & {
  score: number;
};

export function FundRecommendations({ funds }: { funds: RecommendedFund[] }) {
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="size-4 text-violet-400" />
            FIIs em destaque
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Ranking da base cadastrada, atualizado pelo Funds Explorer.
          </p>
        </div>
      </div>

      {funds.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">
          Cadastre preço e dividend yield para ver os FIIs em destaque.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto border-y border-[#39386a]">
          <table className="w-full min-w-75 text-left text-xs">
            <thead className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              <tr>
                <th className="py-3 pr-2" scope="col">
                  FII
                </th>
                <th className="py-3 pr-2" scope="col">
                  Setor
                </th>
                <th className="py-3 pr-2 text-right" scope="col">
                  DY a.a.
                </th>
                <th className="py-3 text-right" scope="col">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {funds.slice(0, 10).map((fund, index) => (
                <tr
                  className="border-t border-[#39386a] text-zinc-300"
                  key={fund.ticker}
                >
                  <td className="py-3 pr-2 font-semibold text-white">
                    <span className="mr-1.5 text-violet-300">{index + 1}.</span>
                    {fund.ticker}
                  </td>
                  <td className="max-w-24 truncate py-3 pr-2">{fund.sector}</td>
                  <td className="py-3 pr-2 text-right">
                    {(fund.annualYield * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </td>
                  <td className="py-3 text-right font-semibold text-sky-300">
                    {fund.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        Score informativo: 60% dividend yield anual, 25% diversificação por setor
        e 15% dados atualizados. Não constitui recomendação de investimento.
      </p>
    </section>
  );
}
