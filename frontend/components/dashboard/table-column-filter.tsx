"use client";

import { Filter, X } from "lucide-react";
import { useState } from "react";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type TableFilterOperator =
  | "contains"
  | "greater_than"
  | "less_than"
  | "equal"
  | "not_equal"
  | "within"
  | "outside";

export type TableColumnFilter = {
  operator: TableFilterOperator;
  value: string;
  endValue: string;
};

export type TableFilterKind = "text" | "number" | "currency" | "date";

type TableColumnFilterButtonProps = {
  label: string;
  kind?: TableFilterKind;
  filter?: TableColumnFilter;
  onChange: (filter: TableColumnFilter | null) => void;
  align?: "left" | "right";
};

const emptyFilter: TableColumnFilter = {
  operator: "contains",
  value: "",
  endValue: "",
};

const operatorLabels: Record<TableFilterOperator, string> = {
  contains: "Contém",
  greater_than: "Maior que",
  less_than: "Menor que",
  equal: "Igual",
  not_equal: "Diferente",
  within: "Dentro de",
  outside: "Fora de",
};

function inputType(kind: TableFilterKind) {
  if (kind === "number") return "number";
  if (kind === "date") return "date";
  return "text";
}

function FilterValueInput({
  kind,
  value,
  onChange,
}: {
  kind: TableFilterKind;
  value: string;
  onChange: (value: string) => void;
}) {
  if (kind === "currency") {
    return (
      <NumericFormat
        allowNegative
        className="border-zinc-700 bg-zinc-900 text-left text-white"
        customInput={Input}
        decimalScale={2}
        decimalSeparator=","
        fixedDecimalScale
        inputMode="decimal"
        prefix="R$ "
        thousandSeparator="."
        value={value}
        onValueChange={({ floatValue }) =>
          onChange(floatValue?.toString() ?? "")
        }
      />
    );
  }

  return (
    <Input
      className="border-zinc-700 bg-zinc-900 text-left text-white"
      placeholder={kind === "text" ? "Informe o valor" : undefined}
      type={inputType(kind)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function TableColumnFilterButton({
  label,
  kind = "text",
  filter,
  onChange,
  align = "left",
}: TableColumnFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TableColumnFilter>(filter ?? emptyFilter);
  const hasRange = draft.operator === "within" || draft.operator === "outside";

  const openModal = () => {
    setDraft(filter ?? emptyFilter);
    setOpen(true);
  };
  const apply = () => {
    if (!draft.value.trim()) {
      onChange(null);
      setOpen(false);
      return;
    }
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <span
        className={`inline-flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}
      >
        {label}
        <Button
          aria-label={`Filtrar coluna ${label}`}
          className={`size-6 ${filter ? "text-sky-300" : "text-zinc-400"}`}
          size="icon-xs"
          type="button"
          variant="ghost"
          onClick={openModal}
        >
          <Filter className="size-3.5" />
        </Button>
      </span>

      {open ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 text-left">
          <Card className="w-full max-w-md border-zinc-700 bg-[#18181b] py-0 text-left shadow-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Filtrar {label}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Escolha a condição e informe o valor desejado.
                  </p>
                </div>
                <Button
                  aria-label="Fechar filtro"
                  className="text-white hover:bg-zinc-800 hover:text-white"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </Button>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                  Condição
                  <select
                    className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-left text-sm text-white outline-none focus:border-sky-400"
                    value={draft.operator}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        operator: event.target.value as TableFilterOperator,
                      })
                    }
                  >
                    {(Object.keys(operatorLabels) as TableFilterOperator[]).map(
                      (operator) => (
                        <option key={operator} value={operator}>
                          {operatorLabels[operator]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div
                  className={
                    hasRange ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"
                  }
                >
                  <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                    {hasRange ? "De" : "Valor"}
                    <FilterValueInput
                      kind={kind}
                      value={draft.value}
                      onChange={(value) => setDraft({ ...draft, value })}
                    />
                  </label>
                  {hasRange ? (
                    <label className="grid gap-1.5 text-sm font-medium text-zinc-200">
                      Até
                      <FilterValueInput
                        kind={kind}
                        value={draft.endValue}
                        onChange={(value) =>
                          setDraft({ ...draft, endValue: value })
                        }
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  className="text-white hover:bg-zinc-800 hover:text-white"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Limpar
                </Button>
                <Button
                  className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                  type="button"
                  onClick={apply}
                >
                  Aplicar filtro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function normalize(value: unknown, kind: TableFilterKind): string | number {
  if (kind === "number" || kind === "currency") return Number(value);
  if (kind === "date") return new Date(`${String(value)}T12:00:00`).getTime();
  return String(value).trim().toLocaleLowerCase("pt-BR");
}

export function matchesTableColumnFilter(
  value: unknown,
  filter: TableColumnFilter | undefined,
  kind: TableFilterKind = "text",
) {
  if (!filter?.value.trim()) return true;

  const normalizedValue = normalize(value, kind);
  const normalizedFirst = normalize(filter.value, kind);
  const normalizedLast = filter.endValue.trim()
    ? normalize(filter.endValue, kind)
    : normalizedFirst;

  if (kind === "text") {
    const text = String(normalizedValue);
    const first = String(normalizedFirst);
    const last = String(normalizedLast);
    switch (filter.operator) {
      case "contains":
        return text.includes(first);
      case "greater_than":
        return text.localeCompare(first) > 0;
      case "less_than":
        return text.localeCompare(first) < 0;
      case "equal":
        return text === first;
      case "not_equal":
        return text !== first;
      case "within":
        return text.localeCompare(first) >= 0 && text.localeCompare(last) <= 0;
      case "outside":
        return text.localeCompare(first) < 0 || text.localeCompare(last) > 0;
    }
  }

  const numericValue = Number(normalizedValue);
  const first = Number(normalizedFirst);
  const last = Number(normalizedLast);
  if ([numericValue, first, last].some(Number.isNaN)) return false;
  switch (filter.operator) {
    case "contains":
    case "equal":
      return numericValue === first;
    case "greater_than":
      return numericValue > first;
    case "less_than":
      return numericValue < first;
    case "not_equal":
      return numericValue !== first;
    case "within":
      return (
        numericValue >= Math.min(first, last) &&
        numericValue <= Math.max(first, last)
      );
    case "outside":
      return (
        numericValue < Math.min(first, last) ||
        numericValue > Math.max(first, last)
      );
  }
}
