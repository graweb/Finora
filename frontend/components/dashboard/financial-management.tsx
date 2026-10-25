"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Copy,
  Edit3,
  Landmark,
  Plus,
  Trash2,
  UserRound,
  X,
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionTooltip } from "./action-tooltip";
import { money } from "./dashboard-types";
import {
  matchesTableColumnFilter,
  TableColumnFilter,
  TableColumnFilterButton,
} from "./table-column-filter";
import { TablePagination } from "./table-pagination";
import { YearSelect } from "./year-select";
import { PageHeader } from "./page-header";

type Destination = "fisica" | "juridica";
type AccountType = "receivable" | "payable";
type View = "all" | Destination;
type Account = {
  id: number;
  counterparty: string;
  account_type: AccountType;
  destination: Destination;
  description: string;
  original_amount: number;
  due_on: string;
  status: "open" | "settled";
  paid_amount: number;
  outstanding_amount: number;
  settlements: { id: number; amount: number; occurred_on: string }[];
};
type AccountList = {
  items: Account[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
};
type Totals = {
  fisica: { income: number; expense: number };
  juridica: { income: number; expense: number };
};
type AccountForm = {
  accountType: AccountType;
  destination: Destination;
  description: string;
  originalAmount: string;
  dueOn: string;
};
type AccountFilterKey =
  | "description"
  | "destination"
  | "accountType"
  | "dueOn"
  | "originalAmount"
  | "paidAmount"
  | "outstandingAmount"
  | "status";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const emptyAccounts: AccountList = {
  items: [],
  pagination: { page: 1, limit: 10, total_items: 0, total_pages: 1 },
};
const tablePageSize = 10;
const emptyTotals: Totals = {
  fisica: { income: 0, expense: 0 },
  juridica: { income: 0, expense: 0 },
};
const emptyForm = (): AccountForm => ({
  accountType: "receivable",
  destination: "fisica",
  description: "",
  originalAmount: "",
  dueOn: "",
});
const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
function Pill({ destination }: { destination: Destination }) {
  return (
    <span
      className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${destination === "fisica" ? "border-sky-400/60 bg-sky-400/10 text-sky-300" : "border-violet-400/60 bg-violet-400/10 text-violet-300"}`}
    >
      {destination === "fisica" ? "Física" : "Jurídica"}
    </span>
  );
}

function MetricGroup({
  destination,
  totals,
}: {
  destination: Destination;
  totals: { income: number; expense: number };
}) {
  const physical = destination === "fisica";
  const balance = totals.income - totals.expense;
  return (
    <Card className="border-[#3a3973] bg-[#222153] py-0 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 text-xl font-semibold text-white">
          <span
            className={`grid size-11 place-items-center rounded-full ${physical ? "bg-sky-500/20 text-sky-400" : "bg-violet-500/20 text-violet-400"}`}
          >
            {physical ? (
              <UserRound className="size-5" />
            ) : (
              <Building2 className="size-5" />
            )}
          </span>
          Pessoa {physical ? "física" : "jurídica"}
        </div>
        <div className="mt-5 grid grid-cols-3 divide-x divide-[#45437a]">
          <Metric
            label="Receitas"
            value={totals.income}
            color="text-emerald-300"
          />
          <Metric
            label="Despesas"
            value={totals.expense}
            color="text-rose-300"
          />
          <Metric
            label="Saldo"
            value={balance}
            color={physical ? "text-sky-300" : "text-violet-300"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`truncate pt-1 text-lg font-semibold lg:text-2xl ${color}`}>
        {money.format(value)}
      </p>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`grid gap-1.5 text-sm font-medium text-zinc-200 ${className ?? ""}`}
    >
      {label}
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0e0d2c]/80 p-4">
      <Card className="w-full max-w-xl border-[#4a4880] bg-[#222153] py-0 shadow-2xl">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar"
              className="text-white hover:bg-[#302e67] hover:text-white"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
          <div className="mt-5">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function FinancialManagement() {
  return (
    <Suspense fallback={null}>
      <FinancialManagementWithReset />
    </Suspense>
  );
}

function FinancialManagementWithReset() {
  const searchParams = useSearchParams();
  return (
    <FinancialManagementContent
      key={searchParams.get("tabReset") ?? "default"}
    />
  );
}

function FinancialManagementContent() {
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(
    null,
  );
  const [view, setView] = useState<View>("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<AccountList>(emptyAccounts);
  const [totals, setTotals] = useState<Totals>(emptyTotals);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<AccountFilterKey, TableColumnFilter>>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState("");
  const [bulkSettlementOpen, setBulkSettlementOpen] = useState(false);
  const [bulkSettlementDate, setBulkSettlementDate] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const now = new Date();
      setPeriod({ year: now.getFullYear(), month: now.getMonth() + 1 });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!period) return;
    let live = true;
    const destination = view === "all" ? "" : `&destination=${view}`;
    Promise.all([
      fetch(
        `${apiUrl}/financial-accounts?page=1&limit=100&year=${period.year}&month=${period.month}${destination}`,
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar o controle financeiro.");
        }
        const firstPage = (await response.json()) as AccountList;
        const remainingPages = await Promise.all(
          Array.from(
            { length: Math.max(0, firstPage.pagination.total_pages - 1) },
            (_, index) =>
              fetch(
                `${apiUrl}/financial-accounts?page=${index + 2}&limit=100&year=${period.year}&month=${period.month}${destination}`,
              ).then(async (nextResponse) => {
                if (!nextResponse.ok) {
                  throw new Error(
                    "Não foi possível carregar o controle financeiro.",
                  );
                }
                return nextResponse.json() as Promise<AccountList>;
              }),
          ),
        );
        return {
          ...firstPage,
          items: [firstPage, ...remainingPages].flatMap((item) => item.items),
        };
      }),
      fetch(
        `${apiUrl}/financial-movements?year=${period.year}&month=${period.month}&page=1&limit=1`,
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar o controle financeiro.");
        }
        return response.json() as Promise<{ totals: Totals }>;
      }),
    ])
      .then(([accounts, movements]) => {
        if (!live) return;
        setData(accounts);
        setTotals(movements.totals);
      })
      .catch((reason) => {
        if (live)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar os dados.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [period, reloadKey, view]);

  const accounts = useMemo(() => {
    return data.items.filter(
      (account) =>
        matchesTableColumnFilter(
          account.description,
          columnFilters.description,
        ) &&
        matchesTableColumnFilter(
          account.destination === "fisica"
            ? "Pessoa física"
            : "Pessoa jurídica",
          columnFilters.destination,
        ) &&
        matchesTableColumnFilter(
          account.account_type === "receivable" ? "A receber" : "A pagar",
          columnFilters.accountType,
        ) &&
        matchesTableColumnFilter(account.due_on, columnFilters.dueOn, "date") &&
        matchesTableColumnFilter(
          account.original_amount,
          columnFilters.originalAmount,
          "number",
        ) &&
        matchesTableColumnFilter(
          account.paid_amount,
          columnFilters.paidAmount,
          "number",
        ) &&
        matchesTableColumnFilter(
          account.outstanding_amount,
          columnFilters.outstandingAmount,
          "number",
        ) &&
        matchesTableColumnFilter(account.status, columnFilters.status),
    );
  }, [columnFilters, data.items]);
  const updateColumnFilter = (
    key: AccountFilterKey,
    filter: TableColumnFilter | null,
  ) => {
    setColumnFilters((current) => {
      const next = { ...current };
      if (filter) next[key] = filter;
      else delete next[key];
      return next;
    });
    setPage(1);
    setSelectedIds([]);
  };
  const totalPages = Math.max(1, Math.ceil(accounts.length / tablePageSize));
  const visibleAccounts = accounts.slice(
    (page - 1) * tablePageSize,
    page * tablePageSize,
  );
  const selected =
    selectedIds.length === 1
      ? (data.items.find((item) => item.id === selectedIds[0]) ?? null)
      : null;
  const selectedAccounts = data.items.filter((account) =>
    selectedIds.includes(account.id),
  );
  const canSettleSelected =
    selectedAccounts.length === selectedIds.length &&
    selectedAccounts.length > 0 &&
    selectedAccounts.every((account) => account.status === "open");
  const allVisibleSelected =
    visibleAccounts.length > 0 &&
    visibleAccounts.every((account) => selectedIds.includes(account.id));
  const years = period
    ? Array.from({ length: 7 }, (_, index) => period.year - 3 + index)
    : [];
  const reload = () => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  };
  const setCurrentView = (value: View) => {
    setLoading(true);
    setView(value);
    setPage(1);
    setSelectedIds([]);
    setExpandedId(null);
  };
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    setSelectedIds([]);
  };
  const changePeriod = (year: number, month: number) => {
    setLoading(true);
    setPeriod({ year, month });
    setSelectedIds([]);
  };
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), dueOn: new Date().toISOString().slice(0, 10) });
    setError("");
    setFormOpen(true);
  };
  const openEdit = (account: Account) => {
    setEditing(account);
    setForm({
      accountType: account.account_type,
      destination: account.destination,
      description: account.description,
      originalAmount: account.original_amount.toString(),
      dueOn: account.due_on,
    });
    setError("");
    setFormOpen(true);
  };
  async function duplicateAccounts() {
    if (!selectedIds.length) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/financial-accounts/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.detail ??
            "Não foi possível duplicar as contas.",
        );
      const duplicatedCount = selectedIds.length;
      setSelectedIds([]);
      reload();
      toast.success(
        duplicatedCount === 1
          ? "Conta duplicada para o próximo mês."
          : `${duplicatedCount} contas duplicadas para o próximo mês.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível duplicar as contas.",
      );
    } finally {
      setSaving(false);
    }
  }
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };
  const openSettlement = (account: Account) => {
    setSelectedIds([account.id]);
    setSettlementAmount("");
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setError("");
    setSettlementOpen(true);
  };
  const openBulkSettlement = () => {
    if (!selectedIds.length) return;
    if (!canSettleSelected) {
      toast.error("Uma ou mais contas selecionadas já foram quitadas.");
      return;
    }
    setBulkSettlementDate(new Date().toISOString().slice(0, 10));
    setError("");
    setBulkSettlementOpen(true);
  };

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editing
          ? `${apiUrl}/financial-accounts/${editing.id}`
          : `${apiUrl}/financial-accounts`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_type: form.accountType,
            destination: form.destination,
            description: form.description.trim(),
            original_amount: Number(form.originalAmount),
            due_on: form.dueOn,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.detail ??
            "Não foi possível salvar a conta.",
        );
      closeForm();
      reload();
      toast.success(
        editing ? "Conta atualizada com sucesso." : "Conta criada com sucesso.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a conta.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/financial-accounts/${selected.id}/settlements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(settlementAmount),
            occurred_on: settlementDate,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.detail ??
            "Não foi possível registrar o abatimento.",
        );
      const updatedAccount = (await response.json()) as Account;
      setData((currentData) => ({
        ...currentData,
        items: currentData.items.map((account) =>
          account.id === updatedAccount.id ? updatedAccount : account,
        ),
      }));
      setSettlementOpen(false);
      reload();
      toast.success("Abatimento registrado com sucesso.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível registrar o abatimento.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function deleteAccounts() {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/financial-accounts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok) throw new Error("Não foi possível excluir a conta.");
      setDeleteOpen(false);
      const deletedCount = selectedIds.length;
      setSelectedIds([]);
      setExpandedId(null);
      reload();
      toast.success(
        deletedCount === 1
          ? "Conta excluída com sucesso."
          : `${deletedCount} contas excluídas com sucesso.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir a conta.",
      );
    } finally {
      setDeleting(false);
    }
  }
  async function settleAccounts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSettleSelected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/financial-accounts/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          occurred_on: bulkSettlementDate,
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.detail ??
            "Não foi possível quitar as contas.",
        );
      const updatedAccounts = (await response.json()) as Account[];
      const accountsById = new Map(
        updatedAccounts.map((account) => [account.id, account]),
      );
      setData((currentData) => ({
        ...currentData,
        items: currentData.items.map(
          (account) => accountsById.get(account.id) ?? account,
        ),
      }));
      const settledCount = selectedIds.length;
      setBulkSettlementOpen(false);
      setSelectedIds([]);
      setExpandedId(null);
      reload();
      toast.success(
        settledCount === 1
          ? "Conta quitada com sucesso."
          : `${settledCount} contas quitadas com sucesso.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível quitar as contas.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-w-0 p-5 pt-20 sm:p-7 sm:pt-20 lg:p-8">
      <div className="mx-auto max-w-360">
        <PageHeader
          title="Controle financeiro"
          description="Acompanhe receitas, despesas, saldos e contas por período."
        />
        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full max-w-175 rounded-xl border border-[#3a3973] bg-[#1b1947] p-1 sm:w-auto">
            {(
              [
                ["all", "Visão consolidada"],
                ["fisica", "Pessoa física"],
                ["juridica", "Pessoa jurídica"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                variant="ghost"
                className={`flex-1 px-5 ${view === value ? "bg-sky-500 text-slate-950 hover:bg-sky-400" : "text-zinc-300 hover:bg-[#302e67] hover:text-white"}`}
                onClick={() => setCurrentView(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <select
              aria-label="Mês"
              value={period?.month ?? ""}
              disabled={!period}
              onChange={(event) =>
                changePeriod(period?.year ?? 2026, Number(event.target.value))
              }
              className="h-10 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm text-zinc-100 outline-none"
            >
              {Array.from({ length: 12 }, (_, index) =>
                new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                }).format(new Date(2026, index, 1)),
              ).map((month, index) => (
                <option key={month} value={index + 1}>
                  {month[0].toUpperCase() + month.slice(1)}
                </option>
              ))}
            </select>
            <YearSelect
              value={period?.year ?? ""}
              years={years}
              disabled={!period}
              onChange={(nextYear) =>
                changePeriod(nextYear, period?.month ?? 1)
              }
            />
            <TooltipProvider>
              <div className="flex flex-wrap gap-2">
                <ActionTooltip label="Nova conta">
                  <Button
                    size="icon-lg"
                    aria-label="Nova conta"
                    className="size-10 bg-sky-500 text-slate-950 hover:bg-sky-400"
                    onClick={openCreate}
                  >
                    <Plus />
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Duplicar contas selecionadas">
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label="Duplicar contas selecionadas"
                    disabled={selectedIds.length === 0 || saving}
                    className="size-10 border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                    onClick={() => void duplicateAccounts()}
                  >
                    <Copy />
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Editar conta">
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label="Editar conta"
                    disabled={!selected || selected.status === "settled"}
                    className="size-10 border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                    onClick={() => selected && openEdit(selected)}
                  >
                    <Edit3 />
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Quitar contas selecionadas">
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label="Quitar contas selecionadas"
                    disabled={selectedIds.length === 0}
                    className="size-10 border-[#4a4880] bg-transparent text-zinc-100 hover:bg-[#302e67] hover:text-white"
                    onClick={openBulkSettlement}
                  >
                    <Landmark />
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Excluir conta">
                  <Button
                    variant="destructive"
                    size="icon-lg"
                    aria-label="Excluir conta"
                    disabled={!canSettleSelected}
                    className="size-10"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 />
                  </Button>
                </ActionTooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <MetricGroup destination="fisica" totals={totals.fisica} />
          <MetricGroup destination="juridica" totals={totals.juridica} />
        </div>
        <div className="mt-5">
          <Card className="border-[#3a3973] bg-[#222153] py-0 shadow-none">
            <CardContent className="p-0">
              {error ? (
                <p className="mx-5 mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-245 text-left text-sm">
                  <thead className="bg-[#29275c] text-xs font-bold uppercase tracking-wide text-zinc-300">
                    <tr>
                      <th className="w-10 px-4 py-4">
                        {accounts.length ? (
                          <input
                            aria-label="Selecionar todas as contas visíveis"
                            checked={allVisibleSelected}
                            className="size-4 accent-sky-400"
                            type="checkbox"
                            onChange={() =>
                              setSelectedIds(
                                allVisibleSelected
                                  ? []
                                  : visibleAccounts.map(
                                      (account) => account.id,
                                    ),
                              )
                            }
                          />
                        ) : null}
                      </th>
                      <th className="w-10 px-4 py-4" />
                      <th className="px-3 py-4">
                        <TableColumnFilterButton
                          filter={columnFilters.description}
                          label="Descrição"
                          onChange={(filter) =>
                            updateColumnFilter("description", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4">
                        <TableColumnFilterButton
                          filter={columnFilters.destination}
                          label="Tipo de pessoa"
                          onChange={(filter) =>
                            updateColumnFilter("destination", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4">
                        <TableColumnFilterButton
                          filter={columnFilters.accountType}
                          label="Tipo"
                          onChange={(filter) =>
                            updateColumnFilter("accountType", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4">
                        <TableColumnFilterButton
                          filter={columnFilters.dueOn}
                          kind="date"
                          label="Vencimento"
                          onChange={(filter) =>
                            updateColumnFilter("dueOn", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4 text-right">
                        <TableColumnFilterButton
                          align="right"
                          filter={columnFilters.originalAmount}
                          kind="number"
                          label="Valor original"
                          onChange={(filter) =>
                            updateColumnFilter("originalAmount", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4 text-right">
                        <TableColumnFilterButton
                          align="right"
                          filter={columnFilters.paidAmount}
                          kind="number"
                          label="Pago"
                          onChange={(filter) =>
                            updateColumnFilter("paidAmount", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4 text-right">
                        <TableColumnFilterButton
                          align="right"
                          filter={columnFilters.outstandingAmount}
                          kind="number"
                          label="Saldo"
                          onChange={(filter) =>
                            updateColumnFilter("outstandingAmount", filter)
                          }
                        />
                      </th>
                      <th className="px-3 py-4">
                        <TableColumnFilterButton
                          filter={columnFilters.status}
                          label="Status"
                          onChange={(filter) =>
                            updateColumnFilter("status", filter)
                          }
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-12 text-center text-zinc-400"
                        >
                          Carregando contas...
                        </td>
                      </tr>
                    ) : accounts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-12 text-center text-zinc-400"
                        >
                          Nenhuma conta encontrada.
                        </td>
                      </tr>
                    ) : (
                      visibleAccounts.map((account) => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          expanded={expandedId === account.id}
                          selected={selectedIds.includes(account.id)}
                          onToggle={() => {
                            setExpandedId(
                              expandedId === account.id ? null : account.id,
                            );
                          }}
                          onSelect={() =>
                            setSelectedIds((ids) =>
                              ids.includes(account.id)
                                ? ids.filter((id) => id !== account.id)
                                : [...ids, account.id],
                            )
                          }
                          onSettle={() => openSettlement(account)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 pb-4">
                <TablePagination
                  page={data.pagination.page}
                  totalPages={totalPages}
                  totalItems={accounts.length}
                  onPageChange={changePage}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.length === 1 ? "conta" : "contas"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá{" "}
              {selectedIds.length === 1
                ? "a conta selecionada"
                : `as ${selectedIds.length} contas selecionadas`}{" "}
              e seus abatimentos. As movimentações geradas pelos abatimentos
              também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void deleteAccounts()}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {formOpen ? (
        <AccountModal
          form={form}
          setForm={setForm}
          saving={saving}
          error={error}
          editing={Boolean(editing)}
          onClose={closeForm}
          onSubmit={saveAccount}
        />
      ) : null}
      {settlementOpen && selected ? (
        <SettlementModal
          account={selected}
          amount={settlementAmount}
          setAmount={setSettlementAmount}
          valueDate={settlementDate}
          setDate={setSettlementDate}
          saving={saving}
          error={error}
          onClose={() => setSettlementOpen(false)}
          onSubmit={saveSettlement}
        />
      ) : null}
      {bulkSettlementOpen ? (
        <BulkSettlementModal
          accounts={selectedAccounts}
          valueDate={bulkSettlementDate}
          setDate={setBulkSettlementDate}
          saving={saving}
          error={error}
          onClose={() => setBulkSettlementOpen(false)}
          onSubmit={settleAccounts}
        />
      ) : null}
    </section>
  );
}

function AccountRow({
  account,
  expanded,
  selected,
  onToggle,
  onSelect,
  onSettle,
}: {
  account: Account;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onSettle: () => void;
}) {
  return (
    <>
      <tr
        className={`border-t border-[#39386a] transition-colors hover:bg-[#29275c]/45 ${selected ? "bg-[#25245b]" : ""}`}
        onClick={onSelect}
      >
        <td className="px-4 py-4">
          <input
            aria-label={`Selecionar ${account.description}`}
            checked={selected}
            className="size-4 accent-sky-400"
            type="checkbox"
            onClick={(event) => event.stopPropagation()}
            onChange={onSelect}
          />
        </td>
        <td className="px-4 py-4">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Exibir abatimentos"
            className="text-zinc-300 hover:bg-[#302e67] hover:text-white"
            onClick={onToggle}
          >
            <ChevronDown
              className={`size-4 text-sky-400 transition-transform ${expanded ? "rotate-180" : "-rotate-90"}`}
            />
          </Button>
        </td>
        <td className="px-3 py-4">
          <span className="font-medium text-white">{account.description}</span>
        </td>
        <td className="px-3 py-4">
          <Pill destination={account.destination} />
        </td>
        <td className="px-3 py-4">
          <span
            className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${account.account_type === "receivable" ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : "border-rose-400/60 bg-rose-400/10 text-rose-300"}`}
          >
            {account.account_type === "receivable" ? "A receber" : "A pagar"}
          </span>
        </td>
        <td className="px-3 py-4 text-zinc-200">{date(account.due_on)}</td>
        <td className="px-3 py-4 text-right text-zinc-100">
          {money.format(account.original_amount)}
        </td>
        <td className="px-3 py-4 text-right text-zinc-100">
          {money.format(account.paid_amount)}
        </td>
        <td className="px-3 py-4 text-right font-medium text-white">
          {money.format(account.outstanding_amount)}
        </td>
        <td className="px-3 py-4">
          <span
            className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${account.status === "open" ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : "border-sky-400/60 bg-sky-400/10 text-sky-300"}`}
          >
            {account.status === "open" ? "Em aberto" : "Quitada"}
          </span>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-[#39386a] bg-[#1d1c49]">
          <td colSpan={10} className="p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(16rem,.75fr)_minmax(0,1.25fr)]">
              <AccountDetails account={account} onSettle={onSettle} />
              <div className="rounded-lg border border-[#39386a] bg-[#181642] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">Abatimentos</h3>
                  <Button
                    disabled={account.status === "settled"}
                    variant="outline"
                    className="border-[#5a5796] bg-transparent text-white hover:bg-[#302e67] hover:text-white"
                    onClick={onSettle}
                  >
                    <Plus /> Registrar abatimento
                  </Button>
                </div>
                {account.settlements.length ? (
                  <ul className="mt-4 space-y-3">
                    {account.settlements.map((settlement) => (
                      <li
                        key={settlement.id}
                        className="flex items-center gap-3 text-sm text-zinc-200"
                      >
                        <span className="size-2 rounded-full bg-sky-400" />
                        Pagamento{" "}
                        {account.account_type === "receivable"
                          ? "recebido"
                          : "realizado"}{" "}
                        · {date(settlement.occurred_on)} ·{" "}
                        {money.format(settlement.amount)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">
                    Nenhum abatimento registrado.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AccountDetails({
  account,
  onSettle,
}: {
  account: Account;
  onSettle: () => void;
}) {
  const progress = account.original_amount
    ? Math.min(100, (account.paid_amount / account.original_amount) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-[#39386a] bg-[#181642] p-4">
      <h3 className="text-lg font-semibold text-white">Resumo da conta</h3>
      <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
        Tipo de pessoa: <Pill destination={account.destination} />
      </div>
      <p className="mt-4 text-sm font-medium text-white">
        {Math.round(progress)}% pago
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#45437a]">
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-5 space-y-3 border-t border-[#39386a] pt-4 text-sm">
        <Row
          label="Valor original"
          value={money.format(account.original_amount)}
        />
        <Row label="Pago" value={money.format(account.paid_amount)} />
        <Row
          label="Saldo devedor"
          value={money.format(account.outstanding_amount)}
          emphasis
        />
      </div>
      <Button
        disabled={account.status === "settled"}
        className="mt-5 h-10 w-full bg-sky-500 text-slate-950 hover:bg-sky-400"
        onClick={onSettle}
      >
        <Landmark /> Registrar pagamento
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <span
        className={emphasis ? "font-semibold text-sky-400" : "text-zinc-100"}
      >
        {value}
      </span>
    </div>
  );
}

function AccountModal({
  form,
  setForm,
  saving,
  error,
  editing,
  onClose,
  onSubmit,
}: {
  form: AccountForm;
  setForm: (next: AccountForm) => void;
  saving: boolean;
  error: string;
  editing: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={editing ? "Editar conta" : "Nova conta"} onClose={onClose}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Tipo">
          <select
            value={form.accountType}
            onChange={(event) =>
              setForm({
                ...form,
                accountType: event.target.value as AccountType,
              })
            }
            className="h-8 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm text-zinc-100 outline-none"
          >
            <option value="receivable">A receber</option>
            <option value="payable">A pagar</option>
          </select>
        </Field>
        <Field label="Vencimento">
          <Input
            required
            type="date"
            value={form.dueOn}
            className="border-[#4a4880] bg-[#181642]"
            onChange={(event) =>
              setForm({ ...form, dueOn: event.target.value })
            }
          />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Input
            required
            value={form.description}
            className="border-[#4a4880] bg-[#181642]"
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <Field label="Tipo de pessoa">
          <select
            value={form.destination}
            onChange={(event) =>
              setForm({
                ...form,
                destination: event.target.value as Destination,
              })
            }
            className="h-8 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm text-zinc-100 outline-none"
          >
            <option value="fisica">Pessoa física</option>
            <option value="juridica">Pessoa jurídica</option>
          </select>
        </Field>
        <Field label="Valor original">
          <NumericFormat
            required
            customInput={Input}
            value={form.originalAmount}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            prefix="R$ "
            allowNegative={false}
            className="border-[#4a4880] bg-[#181642]"
            onValueChange={({ floatValue }) =>
              setForm({ ...form, originalAmount: floatValue?.toString() ?? "" })
            }
          />
        </Field>
        {error ? (
          <p className="text-sm text-red-200 sm:col-span-2">{error}</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <Button
            type="button"
            variant="ghost"
            className="text-white hover:bg-[#302e67] hover:text-white"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-sky-500 text-slate-950 hover:bg-sky-400"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SettlementModal({
  account,
  amount,
  setAmount,
  valueDate,
  setDate,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  account: Account;
  amount: string;
  setAmount: (value: string) => void;
  valueDate: string;
  setDate: (value: string) => void;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title="Registrar abatimento" onClose={onClose}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <p className="text-sm text-zinc-400">
          Saldo atual:{" "}
          <span className="font-medium text-white">
            {money.format(account.outstanding_amount)}
          </span>
        </p>
        <Field label="Valor">
          <NumericFormat
            required
            customInput={Input}
            value={amount}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            prefix="R$ "
            allowNegative={false}
            className="border-[#4a4880] bg-[#181642]"
            onValueChange={({ floatValue }) =>
              setAmount(floatValue?.toString() ?? "")
            }
          />
        </Field>
        <Field label="Data">
          <Input
            required
            type="date"
            value={valueDate}
            className="border-[#4a4880] bg-[#181642]"
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            className="text-white hover:bg-[#302e67] hover:text-white"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-sky-500 text-slate-950 hover:bg-sky-400"
          >
            {saving ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkSettlementModal({
  accounts,
  valueDate,
  setDate,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  accounts: Account[];
  valueDate: string;
  setDate: (value: string) => void;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isSingleAccount = accounts.length === 1;

  return (
    <Modal
      title={isSingleAccount ? "Quitar conta" : "Quitar contas selecionadas"}
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <p className="text-sm text-zinc-400">
          {isSingleAccount
            ? "A quitação registrará o saldo pendente desta conta."
            : `A quitação registrará o saldo pendente das ${accounts.length} contas selecionadas.`}
        </p>
        <Field label="Data do pagamento">
          <Input
            required
            type="date"
            value={valueDate}
            className="border-[#4a4880] bg-[#181642]"
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            className="text-white hover:bg-[#302e67] hover:text-white"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-sky-500 text-slate-950 hover:bg-sky-400"
          >
            {saving ? "Quitando..." : "Confirmar quitação"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
