"use client";

import { FormEvent, useEffect, useState } from "react";
import { Edit3, Plus, RefreshCw, Trash2, WalletCards, X } from "lucide-react";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currency } from "./dashboard-data";

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

const emptyForm: FundForm = {
  ticker: "",
  name: "",
  sector: "",
  latestPrice: "",
  annualDividendYield: "",
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const [funds, setFunds] = useState<InvestmentFund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [form, setForm] = useState<FundForm>(emptyForm);
  const [editingFund, setEditingFund] = useState<InvestmentFund | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadFunds() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/investment-funds`);
      if (!response.ok) {
        throw new Error("Não foi possível carregar os fundos.");
      }
      setFunds(await response.json());
    } catch {
      setError("Não foi possível carregar os fundos da API.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetch(`${apiUrl}/investment-funds`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar os fundos.");
        }
        return response.json() as Promise<InvestmentFund[]>;
      })
      .then((data) => {
        if (isMounted) setFunds(data);
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

  const selectedFund = funds.find((fund) => fund.id === selectedFundId) ?? null;

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

  async function saveFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o fundo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteFund() {
    if (!selectedFund || !window.confirm(`Excluir ${selectedFund.ticker}?`))
      return;
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/investment-funds/${selectedFund.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Não foi possível excluir o fundo.");
      setSelectedFundId(null);
      await loadFunds();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir o fundo.",
      );
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
                onClick={() => void deleteFund()}
                disabled={!selectedFund}
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

          <div className="mt-5 overflow-x-auto rounded-lg border border-[#39386a]">
            <table className="w-full min-w-190 text-left text-sm">
              <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wider text-zinc-300">
                <tr>
                  <th className="w-12 px-4 py-3" scope="col">
                    <span className="sr-only">Selecionar</span>
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
                          checked={selectedFundId === fund.id}
                          className="size-4 accent-sky-400"
                          type="radio"
                          name="selected-fund"
                          onChange={() => setSelectedFundId(fund.id)}
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
        </CardContent>
      </Card>

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
    </section>
  );
}
