import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "../ui/label";

export function IncomeTargetForm({
  value,
  usePortfolio,
  onChange,
  onUsePortfolioChange,
  onCalculate,
}: {
  value: number;
  usePortfolio: boolean;
  onChange: (value: number) => void;
  onUsePortfolioChange: (value: boolean) => void;
  onCalculate: () => void;
}) {
  return (
    <Card className="border-[#4b4990] bg-[#26245b] py-0 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            Quanto você quer receber por mês?
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            A simulação prioriza os FIIs com melhor score da sua base.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Switch
            id="my-wallet"
            checked={usePortfolio}
            className="data-checked:bg-cyan-500"
            onCheckedChange={onUsePortfolioChange}
          />
          <Label htmlFor="my-wallet">Usar minha carteira</Label>
          <NumericFormat
            customInput={Input}
            value={value}
            onValueChange={({ floatValue }) => onChange(floatValue ?? 0)}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            prefix="R$ "
            allowNegative={false}
            inputMode="decimal"
            aria-label="Renda mensal desejada"
            className="min-w-0 flex-1 border-[#57549b] bg-[#1a1946] text-lg font-semibold text-white sm:w-52"
          />
          <Button
            type="button"
            className="bg-violet-600 text-white hover:bg-violet-500"
            onClick={onCalculate}
          >
            Calcular
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
