import { BriefcaseBusiness } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { currency, funds } from "./dashboard-data";

export function FundTable({ capital }: { capital: number }) {
  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <BriefcaseBusiness className="size-4 text-sky-400" />
            Carteira recomendada
          </h2>
          <span className="text-xs text-zinc-400">13 FIIs</span>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#39386a]">
          <div className="grid min-w-165 grid-cols-[minmax(110px,1fr)_130px_82px_90px_120px] bg-[#29275c] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
            <span>FII</span>
            <span>Setor</span>
            <span>Alocação</span>
            <span>Quantidade</span>
            <span className="text-right">Valor</span>
          </div>
          {funds.map((fund) => (
            <div
              className="grid min-w-165 grid-cols-[minmax(110px,1fr)_130px_82px_90px_120px] items-center border-t border-[#39386a] px-3 py-1.5 text-xs"
              key={fund.ticker}
            >
              <span className="truncate font-medium text-white">
                {fund.ticker}
                <i className="ml-2 hidden text-zinc-400 xl:inline not-italic">
                  {fund.name}
                </i>
              </span>
              <span className="truncate text-zinc-300">{fund.sector}</span>
              <span className="font-medium text-white">
                {(fund.weight * 100).toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
              <span className="text-zinc-100">
                {Math.ceil((capital * fund.weight) / fund.referencePrice)} cotas
              </span>
              <span className="text-right text-zinc-100">
                {currency.format(capital * fund.weight)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
