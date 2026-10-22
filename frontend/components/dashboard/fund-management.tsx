"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { currency } from "./dashboard-types";
import { TablePagination } from "./table-pagination";

type InvestmentFund = {
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  latest_price: number | null;
  annual_dividend_yield: number | null;
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

export function FundManagement() {
  const [fundData, setFundData] = useState<FundListResponse>(emptyFundData);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function loadFunds() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/investment-funds?page=${page}&limit=10&search=${encodeURIComponent(search.trim())}`,
      );
      if (!response.ok) {
        throw new Error("Não foi possível carregar os fundos.");
      }
      setFundData(await response.json());
    } catch {
      setError("Não foi possível carregar os fundos da API.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetch(
      `${apiUrl}/investment-funds?page=${page}&limit=10&search=${encodeURIComponent(search.trim())}`,
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar os fundos.");
        }
        return response.json() as Promise<FundListResponse>;
      })
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
  }, [page, search]);

  const funds = fundData.items;
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
      funds.every((fund) => ids.includes(fund.id))
        ? []
        : funds.map((fund) => fund.id),
    );
  }

  function changePage(nextPage: number) {
    setSelectedFundIds([]);
    setIsLoading(true);
    setPage(nextPage);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setSelectedFundIds([]);
    setPage(1);
    setIsLoading(true);
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
      [3000, 12000, 30000, 60000, 80000].forEach((delay) => {
        window.setTimeout(() => {
          void loadFunds();
        }, delay);
      });
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

  return (
    <section className="min-w-0 p-5 sm:p-7 lg:p-8">
      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
                <WalletCards className="size-5 text-sky-400" />
                Fundos imobiliários
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Gerencie os fundos cadastrados na sua carteira.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                onClick={() => void loadFunds()}
                disabled={isLoading}
              >
                <RefreshCw className="size-3.5" /> Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                onClick={() => {
                  setError("");
                  setIsImportOpen(true);
                }}
              >
                <Download className="size-3.5" /> Importar FII
              </Button>
              <Button
                size="sm"
                className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                onClick={openCreateForm}
              >
                <Plus className="size-3.5" /> Adicionar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                onClick={openEditForm}
                disabled={!selectedFund}
              >
                <Edit3 className="size-3.5" /> Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={selectedFundIds.length === 0}
              >
                <Trash2 className="size-3.5" /> Excluir
              </Button>
            </div>
          </div>

          {error && !isFormOpen ? (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <div className="relative mt-4 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              placeholder="Buscar por ticker, nome ou setor"
              className="border-[#4a4880] bg-[#181642] pl-9 text-white placeholder:text-zinc-400"
              onChange={(event) => changeSearch(event.target.value)}
            />
          </div>
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
                        funds.length > 0 &&
                        funds.every((fund) => selectedFundIds.includes(fund.id))
                      }
                      className="size-4 accent-sky-400"
                      type="checkbox"
                      onChange={togglePageSelection}
                    />
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Ticker
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Nome
                  </th>
                  <th className="min-w-48 px-4 py-3" scope="col">
                    Setor
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    Último preço
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    DY anual
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-zinc-400"
                      colSpan={6}
                    >
                      Carregando fundos...
                    </td>
                  </tr>
                ) : funds.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-zinc-400"
                      colSpan={6}
                    >
                      Nenhum fundo cadastrado.
                    </td>
                  </tr>
                ) : (
                  funds.map((fund) => (
                    <tr
                      key={fund.id}
                      className="border-t border-[#39386a] text-zinc-200 transition-colors hover:bg-[#29275c]/45"
                    >
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Selecionar ${fund.ticker}`}
                          checked={selectedFundIds.includes(fund.id)}
                          className="size-4 accent-sky-400"
                          type="checkbox"
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
                          : currency.format(fund.latest_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-200">
                        {fund.annual_dividend_yield === null
                          ? "—"
                          : `${(fund.annual_dividend_yield * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={fundData.pagination.page}
            totalPages={fundData.pagination.total_pages}
            totalItems={fundData.pagination.total_items}
            onPageChange={changePage}
          />
        </CardContent>
      </Card>

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
                  <div className="flex flex-wrap gap-2" aria-label="FIIs adicionados">
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
