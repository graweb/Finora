export type Fund = {
  name: string;
  ticker: string;
  sector: string;
  weight: number;
  annualYield: number;
  referencePrice: number;
};

export const sectorColors: Record<string, string> = {
  Papel: "#8b5cf6",
  Logística: "#38bdf8",
  Shopping: "#fbbf24",
  Multiestratégia: "#34d399",
  Escritórios: "#94a3b8",
  Híbrido: "#f472b6",
  "Não informado": "#a1a1aa",
};

export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function percent(value: number) {
  return `${(value * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

export function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}
