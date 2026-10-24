"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleDollarSign,
  Edit3,
  Plus,
  Trash2,
  WalletCards,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { money } from "./dashboard-types";
import { FundSearchCombobox } from "./fund-search-combobox";
import { TablePagination } from "./table-pagination";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FundOption = {
  id: number;
  ticker: string;
  name: string;
  latest_price: number | string | null;
};
type TransactionType = "buy" | "sell";
type Transaction = {
  id: number;
  investment_fund_id: number;
  transaction_type: TransactionType;
  unit_price: number | string;
  quantity: number;
  total_amount: number | string;
  occurred_on: string;
};
type Position = {
  fund_id: number;
  ticker: string;
  name: string;
  sector: string;
  total_quantity: number;
  total_value: number | string;
  transactions: Transaction[];
};
type PortfolioData = {
  items: Position[];
  totals: { total_value: number | string; total_funds: number };
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};
type TransactionForm = {
  fundId: string;
  transactionType: TransactionType;
  quantity: number;
  unitPrice: number;
  occurredOn: string;
};

const emptyPortfolio: PortfolioData = {
  items: [],
  totals: { total_value: 0, total_funds: 0 },
  page: 1,
  limit: 10,
  total_items: 0,
  total_pages: 1,
};
const createEmptyForm = (): TransactionForm => ({
  fundId: "",
  transactionType: "buy",
  quantity: 1,
  unitPrice: 0,
  occurredOn: "",
});
const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

function ActionTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <Card className="w-full max-w-xl border-zinc-700 bg-[#18181b] py-0 shadow-2xl">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <Button
              aria-label="Fechar"
              className="text-white hover:bg-zinc-800 hover:text-white"
              size="icon-sm"
              variant="ghost"
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

export function PortfolioManagement() {
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>(emptyPortfolio);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState<TransactionForm>(createEmptyForm);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`${apiUrl}/investment-funds?limit=100`).then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ items: FundOption[] }>;
      }),
      fetch(`${apiUrl}/portfolio?page=${page}&limit=10`).then(
        async (response) => {
          if (!response.ok) throw new Error();
          return response.json() as Promise<PortfolioData>;
        },
      ),
    ])
      .then(([fundResponse, portfolioResponse]) => {
        if (!live) return;
        setFunds(fundResponse.items);
        setPortfolio(portfolioResponse);
      })
      .catch(() => {
        if (live) toast.error("Não foi possível carregar a carteira.");
      });
    return () => {
      live = false;
    };
  }, [page, reloadKey]);

  const transactions = useMemo(
    () => portfolio.items.flatMap((position) => position.transactions),
    [portfolio.items],
  );
  const selectedTransaction =
    selectedIds.length === 1
      ? transactions.find((transaction) => transaction.id === selectedIds[0]) ?? null
      : null;
  const selectedTotal = selectedIds.length;

  const openCreate = () => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!selectedTransaction) return;
    setEditing(selectedTransaction);
    setForm({
      fundId: String(selectedTransaction.investment_fund_id),
      transactionType: selectedTransaction.transaction_type,
      quantity: selectedTransaction.quantity,
      unitPrice: Number(selectedTransaction.unit_price),
      occurredOn: selectedTransaction.occurred_on,
    });
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const toggleSelection = (transactionId: number) => {
    setSelectedIds((ids) =>
      ids.includes(transactionId)
        ? ids.filter((id) => id !== transactionId)
        : [...ids, transactionId],
    );
  };
  const reload = () => setReloadKey((value) => value + 1);

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !form.fundId ||
      form.unitPrice <= 0 ||
      form.quantity <= 0 ||
      !form.occurredOn
    ) {
      toast.error("Preencha todos os dados do lançamento.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editing
          ? `${apiUrl}/portfolio/transactions/${editing.id}`
          : `${apiUrl}/portfolio/transactions`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investment_fund_id: Number(form.fundId),
            transaction_type: form.transactionType,
            quantity: form.quantity,
            unit_price: form.unitPrice,
            occurred_on: form.occurredOn,
          }),
        },
      );
      if (!response.ok) throw new Error();
      closeForm();
      setSelectedIds([]);
      setExpandedId(null);
      setPage(1);
      reload();
      toast.success(
        editing
          ? "Lançamento atualizado com sucesso."
          : "Lançamento adicionado à carteira.",
      );
    } catch {
      toast.error("Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTransactions = async () => {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/portfolio/transactions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok) throw new Error();
      const deletedCount = selectedIds.length;
      setDeleteOpen(false);
      setSelectedIds([]);
      reload();
      toast.success(
        deletedCount === 1
          ? "Lançamento excluído com sucesso."
          : `${deletedCount} lançamentos excluídos com sucesso.`,
      );
    } catch {
      toast.error("Não foi possível excluir os lançamentos selecionados.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="min-w-0 p-5 pt-20 sm:p-7 sm:pt-20 lg:p-8">
      <div className="mx-auto max-w-360">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Minha carteira
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Acompanhe suas posições e os lançamentos de compra e venda.
          </p>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <DashboardMetricCard
            icon={WalletCards}
            label="FIIs na carteira"
            value={String(portfolio.totals.total_funds)}
            hint="com lançamentos"
          />
          <DashboardMetricCard
            icon={CircleDollarSign}
            label="Valor total líquido"
            value={money.format(Number(portfolio.totals.total_value))}
            hint="compras menos vendas"
          />
        </div>

        <Card className="mt-5 border-zinc-700 bg-[#18181b] py-0 shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  FIIs em carteira
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Expanda um FII para conferir seus lançamentos.
                </p>
              </div>
              <TooltipProvider>
                <div className="flex gap-2">
                  <ActionTooltip label="Adicionar lançamento">
                    <Button
                      aria-label="Adicionar lançamento"
                      className="size-10 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      size="icon-lg"
                      onClick={openCreate}
                    >
                      <Plus />
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip label="Editar lançamento selecionado">
                    <Button
                      aria-label="Editar lançamento selecionado"
                      className="size-10 border-zinc-700 bg-transparent text-white hover:bg-zinc-800 hover:text-white"
                      disabled={!selectedTransaction}
                      size="icon-lg"
                      variant="outline"
                      onClick={openEdit}
                    >
                      <Edit3 />
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip label="Excluir lançamentos selecionados">
                    <Button
                      aria-label="Excluir lançamentos selecionados"
                      className="size-10"
                      disabled={!selectedTotal}
                      size="icon-lg"
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                    </Button>
                  </ActionTooltip>
                </div>
              </TooltipProvider>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs font-bold tracking-wide text-sky-200 uppercase">
                  <tr>
                    <th className="w-10 px-4 py-4" />
                    <th className="px-3 py-4">FII</th>
                    <th className="px-3 py-4">Setor</th>
                    <th className="px-3 py-4 text-right">Quantidade total</th>
                    <th className="px-4 py-4 text-right">Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.items.map((position) => {
                    const isExpanded = expandedId === position.fund_id;
                    return (
                      <Fragment key={position.fund_id}>
                        <tr
                          className="cursor-pointer border-b border-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-900"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : position.fund_id)
                          }
                        >
                          <td className="px-4 py-4">
                            <ChevronDown
                              className={`size-4 text-sky-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </td>
                          <td className="px-3 py-4">
                            <p className="font-semibold text-white">
                              {position.ticker}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-400">
                              {position.name}
                            </p>
                          </td>
                          <td className="px-3 py-4 text-zinc-400">
                            {position.sector}
                          </td>
                          <td className="px-3 py-4 text-right font-medium text-white">
                            {position.total_quantity}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-white">
                            {money.format(Number(position.total_value))}
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td className="bg-zinc-900/70 px-5 py-4" colSpan={5}>
                              <p className="mb-3 text-xs font-bold tracking-wide text-zinc-400 uppercase">
                                Lançamentos
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-150 text-sm">
                                  <thead className="text-left text-xs text-zinc-500">
                                    <tr>
                                      <th className="w-9 pb-2" />
                                      <th className="pb-2">Tipo</th>
                                      <th className="pb-2 text-right">Quantidade</th>
                                      <th className="pb-2 text-right">Valor unitário</th>
                                      <th className="pb-2 text-right">Valor total</th>
                                      <th className="pb-2 text-right">Data</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {position.transactions.map((transaction) => (
                                      <tr
                                        key={transaction.id}
                                        className="border-t border-zinc-800 text-zinc-300"
                                      >
                                        <td className="py-3">
                                          <input
                                            aria-label={`Selecionar lançamento de ${position.ticker}`}
                                            checked={selectedIds.includes(transaction.id)}
                                            className="size-4 accent-sky-400"
                                            type="checkbox"
                                            onChange={() => toggleSelection(transaction.id)}
                                          />
                                        </td>
                                        <td
                                          className={`py-3 font-medium ${transaction.transaction_type === "buy" ? "text-emerald-300" : "text-rose-300"}`}
                                        >
                                          {transaction.transaction_type === "buy"
                                            ? "Compra"
                                            : "Venda"}
                                        </td>
                                        <td className="py-3 text-right">
                                          {transaction.quantity}
                                        </td>
                                        <td className="py-3 text-right">
                                          {money.format(Number(transaction.unit_price))}
                                        </td>
                                        <td className="py-3 text-right">
                                          {money.format(Number(transaction.total_amount))}
                                        </td>
                                        <td className="py-3 text-right">
                                          {formatDate(transaction.occurred_on)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {portfolio.items.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-400">
                  Nenhum lançamento cadastrado na carteira.
                </p>
              ) : null}
            </div>
            <div className="px-5 pb-4">
              <TablePagination
                page={portfolio.page}
                totalItems={portfolio.total_items}
                totalPages={portfolio.total_pages}
                onPageChange={(nextPage) => {
                  setExpandedId(null);
                  setSelectedIds([]);
                  setPage(nextPage);
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {formOpen ? (
        <PortfolioTransactionModal
          editing={Boolean(editing)}
          form={form}
          funds={funds}
          saving={saving}
          setForm={setForm}
          onClose={closeForm}
          onSubmit={saveTransaction}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedTotal === 1 ? "lançamento" : "lançamentos"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá {selectedTotal === 1 ? "o lançamento selecionado" : `os ${selectedTotal} lançamentos selecionados`} da carteira. Os valores consolidados do FII serão atualizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              disabled={deleting}
              variant="destructive"
              onClick={() => void deleteTransactions()}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function PortfolioTransactionModal({
  editing,
  form,
  funds,
  saving,
  setForm,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  form: TransactionForm;
  funds: FundOption[];
  saving: boolean;
  setForm: (form: TransactionForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const totalAmount = useMemo(
    () => Math.round(form.unitPrice * Math.max(0, form.quantity) * 100) / 100,
    [form.quantity, form.unitPrice],
  );
  const changeFund = (fundId: string) => {
    const fund = funds.find((item) => String(item.id) === fundId);
    setForm({
      ...form,
      fundId,
      unitPrice: Number(fund?.latest_price ?? form.unitPrice),
    });
  };

  return (
    <Modal
      title={editing ? "Editar lançamento" : "Adicionar FII à carteira"}
      onClose={onClose}
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-200 sm:col-span-2">
          FII
          <FundSearchCombobox
            funds={funds}
            value={form.fundId}
            onChange={changeFund}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
          Tipo
          <select
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-sky-400"
            value={form.transactionType}
            onChange={(event) =>
              setForm({
                ...form,
                transactionType: event.target.value as TransactionType,
              })
            }
          >
            <option value="buy">Compra</option>
            <option value="sell">Venda</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
          Data
          <Input
            required
            className="border-zinc-700 bg-zinc-900 text-white"
            type="date"
            value={form.occurredOn}
            onChange={(event) => setForm({ ...form, occurredOn: event.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
          Quantidade
          <Input
            required
            className="border-zinc-700 bg-zinc-900 text-white"
            min={1}
            type="number"
            value={form.quantity}
            onChange={(event) =>
              setForm({ ...form, quantity: Number(event.target.value) })
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
          Valor unitário
          <NumericFormat
            required
            customInput={Input}
            className="border-zinc-700 bg-zinc-900 text-white"
            decimalScale={2}
            decimalSeparator=","
            fixedDecimalScale
            prefix="R$ "
            thousandSeparator="."
            value={form.unitPrice}
            onValueChange={({ floatValue }) =>
              setForm({ ...form, unitPrice: floatValue ?? 0 })
            }
          />
        </label>
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-400 sm:col-span-2">
          Valor do lançamento: {" "}
          <b className="text-white">{money.format(totalAmount)}</b>
        </p>
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <Button
            className="text-white hover:bg-zinc-800 hover:text-white"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            disabled={saving}
            type="submit"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
