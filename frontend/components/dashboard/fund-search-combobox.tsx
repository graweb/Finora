"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "./dashboard-types";

type FundOption = {
  id: number;
  ticker: string;
  name: string;
  latest_price: number | string | null;
};

type FundSearchComboboxProps = {
  funds: FundOption[];
  value: string;
  onChange: (value: string) => void;
};

export function FundSearchCombobox({
  funds,
  value,
  onChange,
}: FundSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedFund = funds.find((fund) => String(fund.id) === value);
  const filteredFunds = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return funds;
    return funds.filter(
      (fund) =>
        fund.ticker.toLowerCase().includes(normalizedSearch) ||
        fund.name.toLowerCase().includes(normalizedSearch),
    );
  }, [funds, search]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-left text-sm text-white outline-none transition-colors hover:border-zinc-600 focus-visible:border-sky-400"
        type="button"
      >
        <span className="truncate">
          {selectedFund
            ? `${selectedFund.ticker} — ${money.format(
                Number(selectedFund.latest_price ?? 0),
              )}`
            : "Selecione um FII"}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 text-zinc-400" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="start"
          className="z-[60]"
          side="bottom"
          sideOffset={8}
        >
          <PopoverPrimitive.Popup className="z-50 w-[var(--anchor-width)] min-w-80 rounded-lg border border-zinc-700 bg-[#18181b] p-2 shadow-2xl outline-none">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por ticker ou nome..."
                className="h-9 border-zinc-700 bg-zinc-900 pl-9 text-white"
              />
            </div>
            <div className="mt-2 max-h-64 overflow-y-auto">
              {filteredFunds.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-400">
                  Nenhum FII encontrado.
                </p>
              ) : (
                filteredFunds.map((fund) => (
                  <Button
                    className="h-auto w-full justify-start gap-2 px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 hover:text-white"
                    key={fund.id}
                    onClick={() => {
                      onChange(String(fund.id));
                      setSearch("");
                      setOpen(false);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <Check
                      className={`size-4 text-sky-400 ${
                        value === String(fund.id) ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="font-semibold">{fund.ticker}</span>
                      <span className="ml-1.5 text-zinc-400">
                        — {fund.name}
                      </span>
                      <span className="ml-1.5 text-sky-300">
                        {money.format(Number(fund.latest_price ?? 0))}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
