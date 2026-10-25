"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type InvestmentPolicy = {
  max_sector_percentage: number;
  max_fund_percentage: number;
  min_sectors: number;
  include_paper: boolean;
  include_brick: boolean;
  include_hybrid: boolean;
  excluded_sectors: string[];
  dividend_yield_weight: number;
  diversification_weight: number;
  liquidity_weight: number;
  available_sectors: string[];
};

const defaultPolicy: InvestmentPolicy = {
  max_sector_percentage: 20,
  max_fund_percentage: 10,
  min_sectors: 5,
  include_paper: true,
  include_brick: true,
  include_hybrid: true,
  excluded_sectors: [],
  dividend_yield_weight: 50,
  diversification_weight: 35,
  liquidity_weight: 15,
  available_sectors: [],
};

function normalizePolicy(policy: InvestmentPolicy): InvestmentPolicy {
  return {
    ...policy,
    max_sector_percentage: Number(policy.max_sector_percentage),
    max_fund_percentage: Number(policy.max_fund_percentage),
    dividend_yield_weight: Number(policy.dividend_yield_weight),
    diversification_weight: Number(policy.diversification_weight),
    liquidity_weight: Number(policy.liquidity_weight),
  };
}

type PolicyNumberKey =
  | "max_sector_percentage"
  | "max_fund_percentage"
  | "min_sectors"
  | "dividend_yield_weight"
  | "diversification_weight"
  | "liquidity_weight";

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm text-zinc-200">
      {label}
      <input
        checked={checked}
        className="peer sr-only"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-6 w-11 rounded-full bg-[#39386a] transition-colors peer-checked:bg-sky-500 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function InvestmentPolicySettings() {
  const [policy, setPolicy] = useState(defaultPolicy);
  const [selectedSector, setSelectedSector] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/settings/investment-policy`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<InvestmentPolicy>;
      })
      .then((data) => {
        if (active) setPolicy(normalizePolicy(data));
      })
      .catch(() => {
        if (active)
          toast.error("Não foi possível carregar a política de investimento.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const weightTotal = useMemo(
    () =>
      policy.dividend_yield_weight +
      policy.diversification_weight +
      policy.liquidity_weight,
    [policy],
  );
  const eligibleSectorCount = useMemo(
    () =>
      policy.available_sectors.filter(
        (sector) => !policy.excluded_sectors.includes(sector),
      ).length,
    [policy.available_sectors, policy.excluded_sectors],
  );

  const updateNumber = (key: PolicyNumberKey, value: number) => {
    setPolicy((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? value : 0,
    }));
  };
  const updateBoolean = (
    key: "include_paper" | "include_brick" | "include_hybrid",
    value: boolean,
  ) => setPolicy((current) => ({ ...current, [key]: value }));
  const addExcludedSector = () => {
    if (!selectedSector) return;
    setPolicy((current) => ({
      ...current,
      excluded_sectors: current.excluded_sectors.includes(selectedSector)
        ? current.excluded_sectors
        : [...current.excluded_sectors, selectedSector],
    }));
    setSelectedSector("");
  };
  const removeExcludedSector = (sector: string) => {
    setPolicy((current) => ({
      ...current,
      excluded_sectors: current.excluded_sectors.filter(
        (item) => item !== sector,
      ),
    }));
  };
  const restoreDefaults = () => {
    setPolicy((current) => ({
      ...defaultPolicy,
      available_sectors: current.available_sectors,
    }));
  };
  const save = async () => {
    if (weightTotal !== 100) {
      toast.error("Os pesos dos critérios precisam somar 100%.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...policy };
      delete (payload as Partial<InvestmentPolicy>).available_sectors;
      const response = await fetch(`${apiUrl}/settings/investment-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json()) as { detail?: string };
        throw new Error(data.detail ?? "Não foi possível salvar a política.");
      }
      setPolicy(normalizePolicy((await response.json()) as InvestmentPolicy));
      toast.success(
        "Política de investimento salva. Recalcule a carteira para aplicar as regras.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a política.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold text-white">
            Limites de exposição
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Defina limites para manter sua carteira diversificada.
          </p>
          <div className="mt-5 grid gap-3">
            {[
              ["Máximo por setor", "max_sector_percentage", "%"],
              ["Máximo por FII", "max_fund_percentage", "%"],
              ["Mínimo de setores", "min_sectors", ""],
            ].map(([label, key, suffix]) => (
              <label
                className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-4 text-sm text-zinc-200"
                key={key}
              >
                {label}
                <div className="relative">
                  <Input
                    className="h-10 border-[#4a4880] bg-[#181642] pr-9 text-white"
                    disabled={isLoading}
                    min="1"
                    type="number"
                    value={policy[key as PolicyNumberKey]}
                    onChange={(event) =>
                      updateNumber(
                        key as PolicyNumberKey,
                        Number(event.target.value),
                      )
                    }
                  />
                  {suffix ? (
                    <span className="absolute inset-y-0 right-3 grid place-items-center text-zinc-400">
                      {suffix}
                    </span>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-5 flex gap-3 rounded-lg border border-sky-400/30 bg-sky-400/10 p-3 text-xs text-sky-100">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-400" />
            Estas regras serão aplicadas ao Planejador de renda e aos aportes
            sugeridos.
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold text-white">
            Universo elegível
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Escolha quais tipos de FII podem ser recomendados.
          </p>
          <div className="mt-4 divide-y divide-[#39386a]">
            <Toggle
              checked={policy.include_paper}
              label="FIIs de Papel"
              onChange={(value) => updateBoolean("include_paper", value)}
            />
            <Toggle
              checked={policy.include_brick}
              label="FIIs de Tijolo"
              onChange={(value) => updateBoolean("include_brick", value)}
            />
            <Toggle
              checked={policy.include_hybrid}
              label="FIIs Híbridos"
              onChange={(value) => updateBoolean("include_hybrid", value)}
            />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-200">
            Setores excluídos
          </p>
          <div className="mt-2 flex gap-2">
            <select
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm text-zinc-100 outline-none"
              value={selectedSector}
              onChange={(event) => setSelectedSector(event.target.value)}
            >
              <option value="">Selecione um setor</option>
              {policy.available_sectors
                .filter((sector) => !policy.excluded_sectors.includes(sector))
                .map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
            </select>
            <Button
              className="h-10 bg-sky-500 text-slate-950 hover:bg-sky-400"
              disabled={!selectedSector}
              onClick={addExcludedSector}
            >
              Adicionar
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {policy.excluded_sectors.map((sector) => (
              <button
                className="rounded-md border border-[#4a4880] bg-[#302e67] px-2 py-1 text-xs text-zinc-100"
                key={sector}
                type="button"
                onClick={() => removeExcludedSector(sector)}
              >
                {sector} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold text-white">
            Critérios de prioridade
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Defina o peso de cada critério no score de recomendação.
          </p>
          <div className="mt-5 grid gap-4">
            {[
              ["Dividend yield", "dividend_yield_weight"],
              ["Diversificação", "diversification_weight"],
              ["Liquidez", "liquidity_weight"],
            ].map(([label, key]) => (
              <label
                className="grid grid-cols-[110px_minmax(0,1fr)_46px] items-center gap-3 text-sm"
                key={key}
              >
                <span className="text-zinc-200">{label}</span>
                <input
                  className="accent-sky-400"
                  max="100"
                  min="0"
                  type="range"
                  value={policy[key as PolicyNumberKey]}
                  onChange={(event) =>
                    updateNumber(
                      key as PolicyNumberKey,
                      Number(event.target.value),
                    )
                  }
                />
                <span className="text-right font-medium text-white">
                  {policy[key as PolicyNumberKey]}%
                </span>
              </label>
            ))}
          </div>
          <p
            className={`mt-5 text-xs ${weightTotal === 100 ? "text-emerald-300" : "text-amber-300"}`}
          >
            Pesos configurados: {weightTotal}% de 100%.
          </p>
        </CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-7 text-sky-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Validação da carteira
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Acompanhe limites que exigem atenção.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {eligibleSectorCount < policy.min_sectors ? (
              <div className="flex gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
                <TriangleAlert className="size-4 shrink-0" />
                Há apenas {eligibleSectorCount} setor(es) elegível(is) para o
                mínimo configurado de {policy.min_sectors}.
              </div>
            ) : (
              <div className="flex gap-3 rounded-lg border border-[#4a4880] bg-[#181642] p-3 text-sm text-zinc-200">
                <CheckCircle2 className="size-4 shrink-0 text-sky-400" />
                {eligibleSectorCount} setores elegíveis — requisito de
                diversificação atendido.
              </div>
            )}
            <div className="flex gap-3 rounded-lg border border-[#4a4880] bg-[#181642] p-3 text-sm text-zinc-200">
              <CheckCircle2 className="size-4 shrink-0 text-sky-400" />A
              política será aplicada ao Planejador e aos aportes.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="col-span-full flex justify-end gap-2">
        <Button
          className="h-10 border-[#4a4880] text-zinc-100 hover:bg-[#302e67]"
          variant="outline"
          onClick={restoreDefaults}
        >
          Restaurar padrão
        </Button>
        <Button
          className="h-10 bg-sky-500 text-slate-950 hover:bg-sky-400"
          disabled={isSaving || isLoading}
          onClick={save}
        >
          {isSaving ? "Salvando..." : "Salvar política"}
        </Button>
      </div>
    </div>
  );
}
