"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Fund } from "./dashboard-types";
import {
  matchesTableColumnFilter,
  TableColumnFilter,
  TableColumnFilterButton,
} from "./table-column-filter";

export type RecommendedFund = Fund & {
  score: number;
};

export function FundRecommendations({ funds }: { funds: RecommendedFund[] }) {
  const [filters, setFilters] = useState<
    Partial<Record<"fund" | "sector" | "yield" | "score", TableColumnFilter>>
  >({});
  const filteredFunds = useMemo(
    () =>
      funds.filter(
        (fund) =>
          matchesTableColumnFilter(fund.ticker, filters.fund) &&
          matchesTableColumnFilter(fund.sector, filters.sector) &&
          matchesTableColumnFilter(
            fund.annualYield * 100,
            filters.yield,
            "number",
          ) &&
          matchesTableColumnFilter(fund.score, filters.score, "number"),
      ),
    [filters, funds],
  );
  const setFilter = (
    key: "fund" | "sector" | "yield" | "score",
    filter: TableColumnFilter | null,
  ) => {
    setFilters((current) => {
      const next = { ...current };
      if (filter) next[key] = filter;
      else delete next[key];
      return next;
    });
  };

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
                  <TableColumnFilterButton
                    filter={filters.fund}
                    label="FII"
                    onChange={(filter) => setFilter("fund", filter)}
                  />
                </th>
                <th className="py-3 pr-2" scope="col">
                  <TableColumnFilterButton
                    filter={filters.sector}
                    label="Setor"
                    onChange={(filter) => setFilter("sector", filter)}
                  />
                </th>
                <th className="py-3 pr-2 text-right" scope="col">
                  <TableColumnFilterButton
                    align="right"
                    filter={filters.yield}
                    kind="number"
                    label="DY a.a."
                    onChange={(filter) => setFilter("yield", filter)}
                  />
                </th>
                <th className="py-3 text-right" scope="col">
                  <TableColumnFilterButton
                    align="right"
                    filter={filters.score}
                    kind="number"
                    label="Score"
                    onChange={(filter) => setFilter("score", filter)}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredFunds.slice(0, 10).map((fund, index) => (
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
          {filteredFunds.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">
              Nenhum FII encontrado para os filtros informados.
            </p>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        Score informativo: 60% dividend yield anual, 25% diversificação por
        setor e 15% dados atualizados. Não constitui recomendação de
        investimento.
      </p>
    </section>
  );
}
