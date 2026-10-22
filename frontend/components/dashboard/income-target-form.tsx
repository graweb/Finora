import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function IncomeTargetForm({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Card className="border-[#4b4990] bg-[#26245b] py-0 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            Quanto você quer receber por mês?
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            A simulação usa o yield ponderado da carteira da planilha.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-67.5">
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
            className="border-[#57549b] bg-[#1a1946] text-lg font-semibold text-white"
          />
          <Button className="bg-violet-600 text-white hover:bg-violet-500">
            Calcular
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
