"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currency } from "./dashboard-data";

type MovementType = "income" | "expense";
type OwnerType = "graweb" | "personal";

type FinancialMovement = {
  id: number;
  movement_type: MovementType;
  owner_type: OwnerType;
  description: string;
  category: string | null;
  amount: number;
  occurred_on: string;
};

type MovementForm = {
  movementType: MovementType;
  ownerType: OwnerType;
  description: string;
  category: string;
  amount: string;
  occurredOn: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function createEmptyForm(occurredOn = ""): MovementForm {
  return {
    movementType: "income",
    ownerType: "graweb",
    description: "",
    category: "",
    amount: "",
    occurredOn,
  };
}

function toForm(movement: FinancialMovement): MovementForm {
  return {
    movementType: movement.movement_type,
    ownerType: movement.owner_type,
    description: movement.description,
    category: movement.category ?? "",
    amount: movement.amount.toString(),
    occurredOn: movement.occurred_on,
  };
}

function toPayload(form: MovementForm) {
  return {
    movement_type: form.movementType,
    owner_type: form.ownerType,
    description: form.description.trim(),
    category: form.category.trim() || null,
    amount: Number(form.amount),
    occurred_on: form.occurredOn,
  };
}

export function FinancialManagement() {
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(
    null,
  );
  const [form, setForm] = useState<MovementForm>(createEmptyForm);
  const [editingMovement, setEditingMovement] =
    useState<FinancialMovement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentDate = new Date();
      setPeriod({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!period) return;
    let isMounted = true;

    fetch(
      `${apiUrl}/financial-movements?year=${period.year}&month=${period.month}`,
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar as movimentações.");
        return response.json() as Promise<FinancialMovement[]>;
      })
      .then((data) => {
        if (isMounted) setMovements(data);
      })
      .catch(() => {
        if (isMounted)
          setError("Não foi possível carregar as movimentações da API.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [period, reloadKey]);

  const selectedMovement =
    movements.find((movement) => movement.id === selectedMovementId) ?? null;
  const totals = useMemo(
    () =>
      movements.reduce(
        (result, movement) => {
          result[movement.owner_type][movement.movement_type] += Number(
            movement.amount,
          );
          return result;
        },
        {
          graweb: { income: 0, expense: 0 },
          personal: { income: 0, expense: 0 },
        },
      ),
    [movements],
  );
  const availableYears = period
    ? Array.from({ length: 7 }, (_, index) => period.year - 3 + index)
    : [];

  function requestReload() {
    setIsLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }

  function changePeriod(nextYear: number, nextMonth: number) {
    setIsLoading(true);
    setError("");
    setSelectedMovementId(null);
    setPeriod({ year: nextYear, month: nextMonth });
  }

  function openCreateForm() {
    setEditingMovement(null);
    setForm(createEmptyForm(new Date().toISOString().slice(0, 10)));
    setError("");
    setIsFormOpen(true);
  }

  function openEditForm() {
    if (!selectedMovement) return;
    setEditingMovement(selectedMovement);
    setForm(toForm(selectedMovement));
    setError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingMovement(null);
    setForm(createEmptyForm());
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingMovement
          ? `${apiUrl}/financial-movements/${editingMovement.id}`
          : `${apiUrl}/financial-movements`,
        {
          method: editingMovement ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(form)),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ?? "Não foi possível salvar a movimentação.",
        );
      }
      closeForm();
      requestReload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar a movimentação.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMovement() {
    if (
      !selectedMovement ||
      !window.confirm(`Excluir ${selectedMovement.description}?`)
    )
      return;
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/financial-movements/${selectedMovement.id}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error("Não foi possível excluir a movimentação.");
      setSelectedMovementId(null);
      requestReload();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir a movimentação.",
      );
    }
  }

  return (
    <section className="min-w-0 p-5 sm:p-7 lg:p-8">
      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
                <WalletCards className="size-5 text-sky-400" /> Controle
                financeiro
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Acompanhe suas entradas e saídas mensais.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Mês"
                value={period?.month ?? ""}
                disabled={!period}
                onChange={(event) =>
                  changePeriod(period?.year ?? 0, Number(event.target.value))
                }
                className="h-7 rounded-lg border border-[#4a4880] bg-[#181642] px-2 text-xs text-zinc-100 outline-none disabled:opacity-50"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Ano"
                value={period?.year ?? ""}
                disabled={!period}
                onChange={(event) =>
                  changePeriod(Number(event.target.value), period?.month ?? 1)
                }
                className="h-7 rounded-lg border border-[#4a4880] bg-[#181642] px-2 text-xs text-zinc-100 outline-none disabled:opacity-50"
              >
                {availableYears.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                className="border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                onClick={requestReload}
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
                disabled={!selectedMovement}
              >
                <Edit3 className="size-3.5" /> Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void deleteMovement()}
                disabled={!selectedMovement}
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
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
              <p className="text-xs font-medium text-zinc-400">
                Receitas Graweb
              </p>
              <p className="mt-1 font-semibold text-emerald-300">
                {currency.format(totals.graweb.income)}
              </p>
            </div>
            <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3">
              <p className="text-xs font-medium text-zinc-400">
                Despesas Graweb
              </p>
              <p className="mt-1 font-semibold text-rose-300">
                {currency.format(totals.graweb.expense)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
              <p className="text-xs font-medium text-zinc-400">
                Receitas Pessoal
              </p>
              <p className="mt-1 font-semibold text-emerald-300">
                {currency.format(totals.personal.income)}
              </p>
            </div>
            <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3">
              <p className="text-xs font-medium text-zinc-400">
                Despesas Pessoal
              </p>
              <p className="mt-1 font-semibold text-rose-300">
                {currency.format(totals.personal.expense)}
              </p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto rounded-lg border border-[#39386a]">
            <table className="w-full min-w-180 text-left text-sm">
              <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wider text-zinc-300">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-zinc-400"
                      colSpan={7}
                    >
                      Carregando movimentações...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-zinc-400"
                      colSpan={7}
                    >
                      Nenhuma movimentação neste período.
                    </td>
                  </tr>
                ) : (
                  movements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="border-t border-[#39386a] text-zinc-200 transition-colors hover:bg-[#29275c]/45"
                    >
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Selecionar ${movement.description}`}
                          checked={selectedMovementId === movement.id}
                          className="size-4 accent-sky-400"
                          type="radio"
                          name="selected-movement"
                          onChange={() => setSelectedMovementId(movement.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {new Date(
                          `${movement.occurred_on}T00:00:00`,
                        ).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${movement.movement_type === "income" ? "text-emerald-300" : "text-rose-300"}`}
                        >
                          {movement.movement_type === "income" ? (
                            <ArrowDownLeft className="size-3.5" />
                          ) : (
                            <ArrowUpRight className="size-3.5" />
                          )}
                          {movement.movement_type === "income"
                            ? "Entrada"
                            : "Saída"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-100">
                        {movement.owner_type === "graweb"
                          ? "Graweb"
                          : "Pessoal"}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {movement.description}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {movement.category ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${movement.movement_type === "income" ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {currency.format(movement.amount)}
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
                  {editingMovement
                    ? "Editar movimentação"
                    : "Adicionar movimentação"}
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
                onSubmit={(event) => void saveMovement(event)}
              >
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Tipo
                  <select
                    value={form.movementType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        movementType: event.target.value as MovementType,
                      })
                    }
                    className="h-8 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm font-normal text-zinc-100 outline-none"
                  >
                    <option value="income">Entrada</option>
                    <option value="expense">Saída</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Data
                  <Input
                    required
                    type="date"
                    value={form.occurredOn}
                    className="border-[#4a4880] bg-[#181642]"
                    onChange={(event) =>
                      setForm({ ...form, occurredOn: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Origem
                  <select
                    value={form.ownerType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ownerType: event.target.value as OwnerType,
                      })
                    }
                    className="h-8 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm font-normal text-zinc-100 outline-none"
                  >
                    <option value="graweb">Graweb</option>
                    <option value="personal">Pessoal</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200 sm:col-span-2">
                  Descrição
                  <Input
                    required
                    maxLength={255}
                    value={form.description}
                    className="border-[#4a4880] bg-[#181642]"
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Categoria
                  <Input
                    maxLength={100}
                    value={form.category}
                    className="border-[#4a4880] bg-[#181642]"
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Valor
                  <NumericFormat
                    required
                    customInput={Input}
                    value={form.amount}
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    prefix="R$ "
                    allowNegative={false}
                    inputMode="decimal"
                    className="border-[#4a4880] bg-[#181642]"
                    onValueChange={({ floatValue }) =>
                      setForm({ ...form, amount: floatValue?.toString() ?? "" })
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
