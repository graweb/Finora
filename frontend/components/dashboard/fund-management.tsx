"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionTooltip } from "./action-tooltip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { money } from "./dashboard-types";
import {
  matchesTableColumnFilter,
  TableColumnFilter,
  TableColumnFilterButton,
} from "./table-column-filter";
import { TablePagination } from "./table-pagination";
import { PageHeader } from "./page-header";

type InvestmentFund = {
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  latest_price: number | null;
  annual_dividend_yield: number | null;
  updated_at: string;
};

type FundForm = {
  ticker: string;
  name: string;
  sector: string;
  latestPrice: string;
  annualDividendYield: string;
};

type FundListResponse = {
  items: InvestmentFund[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
  totals: {
    total_funds: number;
    funds_with_price: number;
    funds_with_dividend_yield: number;
  };
};
type FundSyncJob = {
  status: "running" | "completed";
  total: number;
  processed: number;
  failed: number;
};
type FundFilterKey =
  | "ticker"
  | "name"
  | "sector"
  | "price"
  | "dividendYield"
  | "updatedAt";

const emptyForm: FundForm = {
  ticker: "",
  name: "",
  sector: "",
  latestPrice: "",
  annualDividendYield: "",
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const emptyFundData: FundListResponse = {
  items: [],
  pagination: { page: 1, limit: 10, total_items: 0, total_pages: 1 },
  totals: {
    total_funds: 0,
    funds_with_price: 0,
    funds_with_dividend_yield: 0,
  },
};
const tablePageSize = 10;

async function fetchAllFunds(): Promise<FundListResponse> {
  const firstResponse = await fetch(
    `${apiUrl}/investment-funds?page=1&limit=100`,
  );
  if (!firstResponse.ok)
    throw new Error("Não foi possível carregar os fundos.");
  const firstPage = (await firstResponse.json()) as FundListResponse;
  const remainingPages = await Promise.all(
    Array.from(
      { length: Math.max(0, firstPage.pagination.total_pages - 1) },
      (_, index) =>
        fetch(`${apiUrl}/investment-funds?page=${index + 2}&limit=100`).then(
          async (response) => {
            if (!response.ok)
              throw new Error("Não foi possível carregar os fundos.");
            return response.json() as Promise<FundListResponse>;
          },
        ),
    ),
  );
  return {
    ...firstPage,
    items: [firstPage, ...remainingPages].flatMap((response) => response.items),
  };
}

function toForm(fund: InvestmentFund): FundForm {
  return {
    ticker: fund.ticker,
    name: fund.name,
    sector: fund.sector ?? "",
    latestPrice: fund.latest_price?.toString() ?? "",
    annualDividendYield: fund.annual_dividend_yield?.toString() ?? "",
  };
}

function toPayload(form: FundForm) {
  return {
    ticker: form.ticker.trim(),
    name: form.name.trim(),
    sector: form.sector.trim() || null,
    latest_price: form.latestPrice ? Number(form.latestPrice) : null,
    annual_dividend_yield: form.annualDividendYield
      ? Number(form.annualDividendYield) / 100
      : null,
  };
}

export function FundManagement({ embedded = false }: { embedded?: boolean }) {
  const [fundData, setFundData] = useState<FundListResponse>(emptyFundData);
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<FundFilterKey, TableColumnFilter>>
  >({});
  const [selectedFundIds, setSelectedFundIds] = useState<number[]>([]);
  const [form, setForm] = useState<FundForm>(emptyForm);
  const [editingFund, setEditingFund] = useState<InvestmentFund | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTicker, setImportTicker] = useState("");
  const [importTickers, setImportTickers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function loadFunds({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) {
      setIsLoading(true);
      setError("");
    }
    try {
      setFundData(await fetchAllFunds());
    } catch {
      if (!silent) setError("Não foi possível carregar os fundos da API.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetchAllFunds()
      .then((data) => {
        if (isMounted) setFundData(data);
      })
      .catch(() => {
        if (isMounted) setError("Não foi possível carregar os fundos da API.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const funds = useMemo(
    () =>
      fundData.items.filter(
        (fund) =>
          matchesTableColumnFilter(fund.ticker, columnFilters.ticker) &&
          matchesTableColumnFilter(fund.name, columnFilters.name) &&
          matchesTableColumnFilter(fund.sector ?? "", columnFilters.sector) &&
          matchesTableColumnFilter(
            fund.latest_price ?? "",
            columnFilters.price,
            "number",
          ) &&
          matchesTableColumnFilter(
            fund.annual_dividend_yield === null
              ? ""
              : fund.annual_dividend_yield * 100,
            columnFilters.dividendYield,
            "number",
          ) &&
          matchesTableColumnFilter(
            fund.updated_at.slice(0, 10),
            columnFilters.updatedAt,
            "date",
          ),
      ),
    [columnFilters, fundData.items],
  );
  const totalPages = Math.max(1, Math.ceil(funds.length / tablePageSize));
  const visibleFunds = funds.slice(
    (page - 1) * tablePageSize,
    page * tablePageSize,
  );
  const updateColumnFilter = (
    key: FundFilterKey,
    filter: TableColumnFilter | null,
  ) => {
    setColumnFilters((current) => {
      const next = { ...current };
      if (filter) next[key] = filter;
      else delete next[key];
      return next;
    });
    setPage(1);
    setSelectedFundIds([]);
  };
  const selectedFund =
    selectedFundIds.length === 1
      ? (funds.find((fund) => fund.id === selectedFundIds[0]) ?? null)
      : null;

  function toggleFundSelection(fundId: number) {
    setSelectedFundIds((ids) =>
      ids.includes(fundId)
        ? ids.filter((id) => id !== fundId)
        : [...ids, fundId],
    );
  }

  function togglePageSelection() {
    setSelectedFundIds((ids) =>
      visibleFunds.every((fund) => ids.includes(fund.id))
        ? []
        : visibleFunds.map((fund) => fund.id),
    );
  }

  function changePage(nextPage: number) {
    setSelectedFundIds([]);
    setPage(nextPage);
  }

  function openCreateForm() {
    setEditingFund(null);
    setForm(emptyForm);
    setError("");
    setIsFormOpen(true);
  }

  function openEditForm() {
    if (!selectedFund) return;
    setEditingFund(selectedFund);
    setForm(toForm(selectedFund));
    setError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingFund(null);
    setForm(emptyForm);
  }

  function closeImport() {
    setIsImportOpen(false);
    setImportTicker("");
    setImportTickers([]);
    setError("");
  }

  function addImportTicker() {
    const ticker = importTicker.trim().toUpperCase();
    if (!ticker) {
      setError("Informe o ticker do FII para adicioná-lo à consulta.");
      return;
    }
    if (importTickers.length >= 5) {
      toast.error("Já existem 5 FIIs para serem consultados.");
      return;
    }
    if (importTickers.includes(ticker)) {
      toast.info(`O FII ${ticker} já foi adicionado à consulta.`);
      return;
    }
    setImportTickers((tickers) => [...tickers, ticker]);
    setImportTicker("");
    setError("");
  }

  function removeImportTicker(ticker: string) {
    setImportTickers((tickers) =>
      tickers.filter((importedTicker) => importedTicker !== ticker),
    );
  }

  function scheduleFundsReload(onComplete?: () => void) {
    const delays = [3000, 12000, 30000, 60000, 80000];
    delays.forEach((delay, index) => {
      window.setTimeout(() => {
        void loadFunds({ silent: true }).finally(() => {
          if (index === delays.length - 1) onComplete?.();
        });
      }, delay);
    });
  }

  function watchFundSync(jobId: string) {
    const poll = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/investment-funds/sync/funds-explorer/${jobId}`,
        );
        if (!response.ok) throw new Error();
        const job = (await response.json()) as FundSyncJob;
        await loadFunds({ silent: true });

        if (job.status === "completed") {
          setIsRefreshing(false);
          if (job.failed > 0) {
            toast.warning(
              `Atualização concluída com ${job.failed} FII(s) sem dados disponíveis.`,
            );
          } else {
            toast.success("Todos os FIIs selecionados foram atualizados.");
          }
          return;
        }
        window.setTimeout(() => void poll(), 2000);
      } catch {
        setIsRefreshing(false);
        toast.error("Não foi possível acompanhar a atualização dos FIIs.");
      }
    };
    void poll();
  }

  function requestFundsSync() {
    if (selectedFundIds.length === 0) {
      toast.error("Selecione pelo menos um FII para atualizar.");
      return;
    }
    setIsSyncDialogOpen(true);
  }

  async function syncFunds() {
    setIsSyncing(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/investment-funds/sync/funds-explorer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedFundIds }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "Não foi possível atualizar os FIIs.");
      }
      const result = (await response.json().catch(() => null)) as {
        detail?: string;
        job_id?: string;
      } | null;
      setIsSyncDialogOpen(false);
      toast.info(
        result?.detail ??
          "A atualização dos FIIs foi agendada em segundo plano.",
      );
      setIsRefreshing(true);
      if (result?.job_id) watchFundSync(result.job_id);
      else setIsRefreshing(false);
    } catch (syncError) {
      const message =
        syncError instanceof Error
          ? syncError.message
          : "Não foi possível atualizar os FIIs.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function importFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (importTickers.length === 0) {
      setError("Adicione pelo menos um FII à consulta.");
      return;
    }
    setIsImporting(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/investment-funds/import/funds-explorer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: importTickers }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "Não foi possível importar o fundo.");
      }
      const result = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      closeImport();
      toast.info(
        result?.detail ??
          "A consulta no Funds Explorer foi agendada em segundo plano.",
      );
      scheduleFundsReload();
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : "Não foi possível importar o fundo.";
      setError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }

  async function saveFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const successMessage = editingFund
      ? "Fundo imobiliário atualizado com sucesso."
      : "Fundo imobiliário criado com sucesso.";
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingFund
          ? `${apiUrl}/investment-funds/${editingFund.id}`
          : `${apiUrl}/investment-funds`,
        {
          method: editingFund ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(form)),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "Não foi possível salvar o fundo.");
      }
      closeForm();
      await loadFunds();
      toast.success(successMessage);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o fundo.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteFunds() {
    if (selectedFundIds.length === 0) return;
    const deletedCount = selectedFundIds.length;
    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/investment-funds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedFundIds }),
      });
      if (!response.ok) throw new Error("Não foi possível excluir o fundo.");
      setSelectedFundIds([]);
      setIsDeleteDialogOpen(false);
      await loadFunds();
      toast.success(
        `${deletedCount} fundo${deletedCount === 1 ? "" : "s"} excluído${deletedCount === 1 ? "" : "s"} com sucesso.`,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir o fundo.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const fundActions = (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        <ActionTooltip label="Atualizar FIIs selecionados">
          <Button
            aria-label="Atualizar FIIs selecionados"
            variant="outline"
            size="icon-lg"
            className="size-10 border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
            onClick={requestFundsSync}
            disabled={isSyncing || isRefreshing}
          >
            <RefreshCw
              className={`size-4 ${isSyncing || isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Importar FIIs">
          <Button
            aria-label="Importar FIIs"
            variant="outline"
            size="icon-lg"
            className="size-10 border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
            onClick={() => {
              setError("");
              setIsImportOpen(true);
            }}
          >
            <Download className="size-4" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Adicionar FII">
          <Button
            aria-label="Adicionar FII"
            size="icon-lg"
            className="size-10 bg-sky-500 text-slate-950 hover:bg-sky-400"
            onClick={openCreateForm}
          >
            <Plus className="size-4" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Editar FII selecionado">
          <Button
            aria-label="Editar FII selecionado"
            variant="outline"
            size="icon-lg"
            className="size-10 border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
            onClick={openEditForm}
            disabled={!selectedFund}
          >
            <Edit3 className="size-4" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Excluir FIIs selecionados">
          <Button
            aria-label="Excluir FIIs selecionados"
            variant="destructive"
            size="icon-lg"
            className="size-10"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={selectedFundIds.length === 0}
          >
            <Trash2 className="size-4" />
          </Button>
        </ActionTooltip>
      </div>
    </TooltipProvider>
  );

  return (
    <section
      className={
        embedded ? "contents" : "min-w-0 p-5 pt-20 sm:p-7 sm:pt-20 lg:p-8"
      }
    >
      {!embedded ? (
        <PageHeader
          title="Fundos imobiliários"
          description="Gerencie os fundos cadastrados na sua carteira."
        />
      ) : null}
      {embedded ? (
        <div className="mt-3 flex justify-end xl:absolute xl:top-0 xl:right-0 xl:mt-0">
          {fundActions}
        </div>
      ) : null}
      <Card className="mt-5 border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5 sm:p-6">
          {!embedded ? (
            <div className="flex justify-end">{fundActions}</div>
          ) : null}

          {error && !isFormOpen ? (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-zinc-400">
            {fundData.totals.total_funds} fundos cadastrados ·{" "}
            {fundData.totals.funds_with_price} com cotação ·{" "}
            {fundData.totals.funds_with_dividend_yield} com DY
          </p>

          <div className="mt-5 overflow-x-auto rounded-lg border border-[#39386a]">
            <table className="w-full min-w-190 text-left text-sm">
              <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wider text-zinc-300">
                <tr>
                  <th className="w-12 px-4 py-3" scope="col">
                    <input
                      aria-label="Selecionar todos os fundos desta página"
                      checked={
                        visibleFunds.length > 0 &&
                        visibleFunds.every((fund) =>
                          selectedFundIds.includes(fund.id),
                        )
                      }
                      className="size-4 accent-sky-400"
                      type="checkbox"
                      onChange={togglePageSelection}
                    />
                  </th>
                  <th className="px-4 py-3" scope="col">
                    <TableColumnFilterButton
                      filter={columnFilters.ticker}
                      label="Ticker"
                      onChange={(filter) =>
                        updateColumnFilter("ticker", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3" scope="col">
                    <TableColumnFilterButton
                      filter={columnFilters.name}
                      label="Nome"
                      onChange={(filter) => updateColumnFilter("name", filter)}
                    />
                  </th>
                  <th className="min-w-48 px-4 py-3" scope="col">
                    <TableColumnFilterButton
                      filter={columnFilters.sector}
                      label="Setor"
                      onChange={(filter) =>
                        updateColumnFilter("sector", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.price}
                      kind="number"
                      label="Último preço"
                      onChange={(filter) => updateColumnFilter("price", filter)}
                    />
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.dividendYield}
                      kind="number"
                      label="DY anual"
                      onChange={(filter) =>
                        updateColumnFilter("dividendYield", filter)
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    <TableColumnFilterButton
                      align="right"
                      filter={columnFilters.updatedAt}
                      kind="date"
                      label="Última atualização"
                      onChange={(filter) =>
                        updateColumnFilter("updatedAt", filter)
                      }
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-zinc-400"
                      colSpan={7}
                    >
                      Carregando fundos...
                    </td>
                  </tr>
                ) : funds.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-zinc-400"
                      colSpan={7}
                    >
                      Nenhum fundo cadastrado.
                    </td>
                  </tr>
                ) : (
                  visibleFunds.map((fund) => (
                    <tr
                      key={fund.id}
                      className="cursor-pointer border-t border-[#39386a] text-zinc-200 transition-colors hover:bg-[#29275c]/45"
                      onClick={() => toggleFundSelection(fund.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Selecionar ${fund.ticker}`}
                          checked={selectedFundIds.includes(fund.id)}
                          className="size-4 accent-sky-400"
                          type="checkbox"
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleFundSelection(fund.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {fund.ticker}
                      </td>
                      <td className="px-4 py-3">{fund.name}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        {fund.sector ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {fund.latest_price === null
                          ? "—"
                          : money.format(fund.latest_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-200">
                        {fund.annual_dividend_yield === null
                          ? "—"
                          : `${(fund.annual_dividend_yield * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-zinc-300">
                        {new Date(fund.updated_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={funds.length}
            onPageChange={changePage}
          />
        </CardContent>
      </Card>

      <AlertDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar cotação dos FIIs?</AlertDialogTitle>
            <AlertDialogDescription>
              Os valores de {selectedFundIds.length} FII(s) selecionado(s) serão
              atualizados de acordo com a cotação atual. A consulta será
              executada em segundo plano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSyncing}>Cancelar</AlertDialogCancel>
            <Button
              className="bg-sky-500 text-slate-950 hover:bg-sky-400"
              disabled={isSyncing}
              onClick={() => void syncFunds()}
            >
              {isSyncing ? "Agendando..." : "Atualizar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fundos imobiliários?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá {selectedFundIds.length} fundo(s)
              selecionado(s) e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void deleteFunds()}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0e0d2c]/80 p-4">
          <Card className="w-full max-w-xl border-[#4a4880] bg-[#222153] py-0 shadow-2xl">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {editingFund ? "Editar fundo" : "Adicionar fundo"}
                </h2>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Fechar"
                  className="text-white hover:bg-[#302e67] hover:text-white"
                  onClick={closeForm}
                >
                  <X />
                </Button>
              </div>
              <form
                className="mt-5 grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => void saveFund(event)}
              >
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Ticker
                  <Input
                    required
                    maxLength={10}
                    value={form.ticker}
                    className="border-[#4a4880] bg-[#181642] uppercase"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ticker: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Setor
                  <Input
                    maxLength={100}
                    value={form.sector}
                    className="border-[#4a4880] bg-[#181642]"
                    onChange={(event) =>
                      setForm({ ...form, sector: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200 sm:col-span-2">
                  Nome
                  <Input
                    required
                    maxLength={255}
                    value={form.name}
                    className="border-[#4a4880] bg-[#181642]"
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Último preço (R$)
                  <NumericFormat
                    customInput={Input}
                    value={form.latestPrice}
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    prefix="R$ "
                    allowNegative={false}
                    inputMode="decimal"
                    className="border-[#4a4880] bg-[#181642]"
                    onValueChange={({ floatValue }) =>
                      setForm({
                        ...form,
                        latestPrice: floatValue?.toString() ?? "",
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  DY anual (%)
                  <Input
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.annualDividendYield}
                    className="border-[#4a4880] bg-[#181642]"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        annualDividendYield: event.target.value,
                      })
                    }
                  />
                </label>
                {error ? (
                  <p className="text-sm text-red-200 sm:col-span-2">{error}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-white hover:bg-[#302e67] hover:text-white"
                    onClick={closeForm}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                    disabled={isSaving}
                  >
                    {isSaving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {isImportOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0e0d2c]/80 p-4">
          <Card className="w-full max-w-md border-[#4a4880] bg-[#222153] py-0 shadow-2xl">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Importar FIIs pelo Funds Explorer
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Adicione até cinco tickers para consultar em segundo plano.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Fechar"
                  className="text-white hover:bg-[#302e67] hover:text-white"
                  onClick={closeImport}
                >
                  <X />
                </Button>
              </div>
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => void importFund(event)}
              >
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Tickers
                  <div className="flex gap-2">
                    <Input
                      value={importTicker}
                      placeholder="Ex.: HGLG11"
                      className="border-[#4a4880] bg-[#181642] uppercase text-white"
                      onChange={(event) =>
                        setImportTicker(event.target.value.toUpperCase())
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      aria-label="Adicionar FII à consulta"
                      className="shrink-0 bg-sky-500 text-slate-950 hover:bg-sky-400"
                      onClick={addImportTicker}
                    >
                      <Plus />
                    </Button>
                  </div>
                </label>
                {importTickers.length > 0 ? (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="FIIs adicionados"
                  >
                    {importTickers.map((ticker) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                        key={ticker}
                      >
                        {ticker}
                        <button
                          type="button"
                          className="rounded-sm text-sky-200 hover:text-white"
                          aria-label={`Remover ${ticker}`}
                          onClick={() => removeImportTicker(ticker)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-zinc-400">
                  {importTickers.length} de 5 FIIs adicionados
                </p>
                {error ? <p className="text-sm text-red-200">{error}</p> : null}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-white hover:bg-[#302e67] hover:text-white"
                    onClick={closeImport}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                    disabled={isImporting}
                  >
                    {isImporting ? "Agendando..." : "Agendar consulta"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
