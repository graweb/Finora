import { BarChart3, PieChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { money, type Fund } from "./dashboard-types";

export function AllocationBars({
  funds,
  capital,
}: {
  funds: Fund[];
  capital: number;
}) {
  const maximum = Math.max(...funds.map((fund) => fund.weight));
  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <BarChart3 className="size-4 text-sky-400" />
            Alocação por FII
          </h2>
          <span className="text-xs text-zinc-400">Top posições</span>
        </div>
        <div className="mt-5 flex h-40 items-end justify-between gap-2">
          {funds.slice(0, 7).map((fund) => (
            <div
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              key={fund.ticker}
            >
              <span className="text-[10px] text-zinc-300">
                {Math.round(fund.weight * 100)}%
              </span>
              <i
                className="w-full max-w-8 rounded-t-md bg-linear-to-t from-violet-600 to-sky-400"
                style={{ height: `${(fund.weight / maximum) * 112}px` }}
              />
              <span className="text-[10px] text-zinc-400">
                {fund.ticker.replace("11", "")}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Montante distribuído:{" "}
          <b className="text-zinc-100">{money.format(capital)}</b>
        </p>
      </CardContent>
    </Card>
  );
}

export function SectorDonut({ sectors }: { sectors: Array<[string, number]> }) {
  const coloredSectors = sectors.map(([name, share], index) => ({
    name,
    share,
    color: `hsl(${Math.round((index * 360) / sectors.length)} 82% 62%)`,
  }));
  const gradient =
    coloredSectors
      .reduce((result, { color, share }, index) => {
        const before = coloredSectors
          .slice(0, index)
          .reduce((sum, sector) => sum + sector.share, 0);
        return `${result}${color} ${before * 100}% ${(before + share) * 100}%,`;
      }, "conic-gradient(")
      .slice(0, -1) + ")";
  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <PieChart className="size-4 text-sky-400" />
          Distribuição por setor
        </h2>
        <div className="mt-5 flex items-center gap-7">
          <div
            className="grid size-44 shrink-0 place-items-center rounded-full"
            style={{ background: gradient }}
          >
            <div className="grid size-28 place-items-center rounded-full bg-[#222153] text-center">
              <b className="text-lg text-white">100%</b>
              <span className="text-[10px] text-zinc-400">carteira</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3 pl-2">
            {coloredSectors.map(({ name, share, color }) => (
              <div
                className="flex items-center justify-between gap-4 text-xs"
                key={name}
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  <i
                    className="size-2 rounded-full"
                    style={{ background: color }}
                  />
                  {name}
                </span>
                <b className="text-zinc-100">
                  {(share * 100).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </b>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
