"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BarChart3,
  CalendarDays,
  RefreshCw,
  ReceiptText,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  matchesTableColumnFilter,
  TableColumnFilter,
  TableColumnFilterButton,
} from "./table-column-filter";
import { TablePagination } from "./table-pagination";
import { YearSelect } from "./year-select";
import { currency } from "./dashboard-types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Dividend = {
  id: number;
  investment_fund_id: number;
  ex_date: string;
  payment_date: string;
  amount_per_share: number | string;
  ticker: string;
  fund_name: string;
  eligible_quantity: number;
  calculated_amount: number | string;
  adjustment_amount: number | string;
  total_amount: number | string;
};
type DividendResponse = {
  items: Dividend[];
  totals: { total_received: number | string; total_records: number };
};
type DividendFilterKey =
  | "fund"
  | "exDate"
  | "paymentDate"
  | "amountPerShare"
  | "quantity"
  | "calculated"
  | "adjustment"
  | "total";
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export function PortfolioDividends({ tabs }: { tabs: ReactNode }) {
  const [dividends, setDividends] = useState<DividendResponse>({
    items: [],
    totals: { total_received: 0, total_records: 0 },
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<DividendFilterKey, TableColumnFilter>>
  >({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Dividend | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const loadData = useCallback(async () => {
    const response = await fetch(
      `${apiUrl}/portfolio/dividends?year=${year}&limit=100&page=1`,
    );
    if (!response.ok) throw new Error();
    const firstPage = (await response.json()) as DividendResponse & {
      total_pages: number;
    };
    const remainingPages = await Promise.all(
      Array.from(
        { length: Math.max(0, firstPage.total_pages - 1) },
        (_, index) =>
          fetch(
            `${apiUrl}/portfolio/dividends?year=${year}&limit=100&page=${index + 2}`,
          ).then((next) => next.json() as Promise<DividendResponse>),
      ),
    );
    setDividends({
      ...firstPage,
      items: [
        ...firstPage.items,
        ...remainingPages.flatMap((next) => next.items),
      ],
    });
  }, [year]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData().catch(() =>
        toast.error("Não foi possível carregar os dividendos calculados."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);
  useEffect(() => {
    if (!syncJobId) return;
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/portfolio/dividends/sync/${syncJobId}`,
        );
        if (!response.ok) throw new Error();
        const job = (await response.json()) as { status: string };
        if (active && job.status === "completed") {
          setSyncJobId(null);
          setIsSyncing(false);
          void loadData();
          toast.success("Proventos sincronizados com sucesso.");
        }
      } catch {
        if (active) {
          setSyncJobId(null);
          setIsSyncing(false);
          toast.error(
            "Não foi possível acompanhar a sincronização dos proventos.",
          );
        }
      }
    };
    void checkStatus();
    const interval = window.setInterval(() => void checkStatus(), 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadData, syncJobId]);
  const totalReceived = Number(dividends.totals.total_received);
  const selectedDividend =
    dividends.items.find((item) => item.id === selectedId) ?? null;
  const filteredItems = useMemo(
    () =>
      dividends.items.filter(
        (item) =>
          matchesTableColumnFilter(
            `${item.ticker} ${item.fund_name}`,
            columnFilters.fund,
          ) &&
          matchesTableColumnFilter(
            item.ex_date,
            columnFilters.exDate,
            "date",
          ) &&
          matchesTableColumnFilter(
            item.payment_date,
            columnFilters.paymentDate,
            "date",
          ) &&
          matchesTableColumnFilter(
            item.amount_per_share,
            columnFilters.amountPerShare,
            "number",
          ) &&
          matchesTableColumnFilter(
            item.eligible_quantity,
            columnFilters.quantity,
            "number",
          ) &&
          matchesTableColumnFilter(
            item.calculated_amount,
            columnFilters.calculated,
            "number",
          ) &&
          matchesTableColumnFilter(
            item.adjustment_amount,
            columnFilters.adjustment,
            "number",
          ) &&
          matchesTableColumnFilter(
            item.total_amount,
            columnFilters.total,
            "number",
          ),
      ),
    [columnFilters, dividends.items],
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / 10));
  const visibleItems = filteredItems.slice((page - 1) * 10, page * 10);
  const updateColumnFilter = (
    key: DividendFilterKey,
    filter: TableColumnFilter | null,
  ) => {
    setColumnFilters((current) => ({ ...current, [key]: filter ?? undefined }));
    setPage(1);
  };
  const syncDividends = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${apiUrl}/portfolio/dividends/sync`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { job_id: string };
      setSyncJobId(payload.job_id);
      toast.success("Atualização de proventos iniciada em segundo plano.");
    } catch {
      setIsSyncing(false);
      toast.error("Não foi possível iniciar a atualização dos proventos.");
    }
  };
  const openAdjustment = () => {
    if (!selectedDividend) return;
    setAdjusting(selectedDividend);
    setAdjustment(Number(selectedDividend.adjustment_amount));
    setNote("");
  };
  const saveAdjustment = async () => {
    if (!adjusting) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `${apiUrl}/portfolio/dividends/${adjusting.id}/adjustment`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount_delta: adjustment, note }),
        },
      );
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { detail?: string }).detail,
        );
      setAdjusting(null);
      await loadData();
      toast.success("Ajuste excepcional salvo.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o ajuste.",
      );
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {tabs}
        <div className="flex items-center gap-2">
          <YearSelect
            value={year}
            years={[year - 1, year, year + 1]}
            onChange={(nextYear) => {
              setYear(nextYear);
              setPage(1);
            }}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button
                  aria-label="Sincronizar eventos"
                  className="size-10 bg-sky-500 text-slate-950 hover:bg-sky-400"
                  disabled={isSyncing}
                  size="icon-lg"
                  onClick={() => void syncDividends()}
                >
                  {isSyncing ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sincronizar eventos</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button
                  aria-label="Ajustar dividendo calculado"
                  disabled={!selectedDividend}
                  size="icon-lg"
                  variant="outline"
                  className="size-10 border-[#4a4880] bg-transparent text-zinc-100"
                  onClick={openAdjustment}
                >
                  <SlidersHorizontal />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajustar dividendo calculado</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <MetricCard
          icon={ReceiptText}
          label="Recebido no ano"
          value={currency.format(totalReceived)}
          hint={`${dividends.totals.total_records} evento(s) calculado(s)`}
        />
        <MetricCard
          icon={BarChart3}
          label="Média mensal"
          value={currency.format(totalReceived / 12)}
          hint="proventos calculados"
        />
      </div>
      <Card className="mt-5 border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-250 text-left text-sm">
              <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wide text-zinc-300">
                <tr>
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3">
                    <TableColumnFilterButton
                      filter={columnFilters.fund}
                      label="FII"
                      onChange={(filter) => updateColumnFilter("fund", filter)}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <TableColumnFilterButton
                      filter={columnFilters.exDate}
                      kind="date"
                      label="Data-com"
                      onChange={(filter) =>
                        updateColumnFilter("exDate", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3">
                    <TableColumnFilterButton
                      filter={columnFilters.paymentDate}
                      kind="date"
                      label="Pagamento"
                      onChange={(filter) =>
                        updateColumnFilter("paymentDate", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.amountPerShare}
                      kind="number"
                      label="Valor/cota"
                      onChange={(filter) =>
                        updateColumnFilter("amountPerShare", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.quantity}
                      kind="number"
                      label="Cotas elegíveis"
                      onChange={(filter) =>
                        updateColumnFilter("quantity", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.calculated}
                      kind="number"
                      label="Calculado"
                      onChange={(filter) =>
                        updateColumnFilter("calculated", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.adjustment}
                      kind="number"
                      label="Ajuste"
                      onChange={(filter) =>
                        updateColumnFilter("adjustment", filter)
                      }
                    />
                  </th>
                  <th className="px-5 py-3 text-right">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.total}
                      kind="number"
                      label="Total"
                      onChange={(filter) => updateColumnFilter("total", filter)}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr
                    className="cursor-pointer border-t border-[#39386a] text-zinc-300 transition-colors hover:bg-[#29275c]/45"
                    key={item.id}
                    onClick={() =>
                      setSelectedId((id) => (id === item.id ? null : item.id))
                    }
                  >
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Selecionar dividendo de ${item.ticker}`}
                        checked={selectedId === item.id}
                        className="size-4 accent-sky-400"
                        type="checkbox"
                        onClick={(event) => event.stopPropagation()}
                        onChange={() =>
                          setSelectedId((id) =>
                            id === item.id ? null : item.id,
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{item.ticker}</p>
                      <p className="text-xs text-zinc-400">{item.fund_name}</p>
                    </td>
                    <td className="px-4 py-3">{dateLabel(item.ex_date)}</td>
                    <td className="px-4 py-3">
                      {dateLabel(item.payment_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {currency.format(Number(item.amount_per_share))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.eligible_quantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {currency.format(Number(item.calculated_amount))}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-200">
                      {Number(item.adjustment_amount) === 0
                        ? "—"
                        : currency.format(Number(item.adjustment_amount))}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-300">
                      {currency.format(Number(item.total_amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-400">
                Nenhum evento encontrado para os filtros selecionados.
              </p>
            ) : null}
          </div>
          <div className="px-5 pb-4">
            <TablePagination
              page={page}
              totalItems={filteredItems.length}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
      <AlertDialog
        open={Boolean(adjusting)}
        onOpenChange={(open) => !open && setAdjusting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajuste excepcional de dividendo</AlertDialogTitle>
            <AlertDialogDescription>
              {adjusting
                ? `${adjusting.ticker} · pagamento em ${dateLabel(adjusting.payment_date)}. Informe apenas a diferença em relação ao valor calculado.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
              Diferença no total recebido
              <NumericFormat
                customInput={Input}
                className="border-[#4a4880] bg-[#181642] text-white"
                decimalScale={2}
                decimalSeparator=","
                fixedDecimalScale
                prefix="R$ "
                thousandSeparator="."
                value={adjustment}
                onValueChange={({ floatValue }) =>
                  setAdjustment(floatValue ?? 0)
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
              Motivo do ajuste (opcional)
              <Input
                className="border-[#4a4880] bg-[#181642] text-white"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={isSaving}
              onClick={() => void saveAdjustment()}
              className="bg-sky-500 text-slate-950 hover:bg-sky-400"
            >
              {isSaving ? "Salvando..." : "Salvar ajuste"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="flex min-h-24.5 items-center gap-3 p-4">
        <span className="grid size-9 place-items-center rounded-lg bg-[#2d2b62] text-sky-400">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-zinc-300">{label}</p>
          <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
