export type Fund = {
  name: string;
  ticker: string;
  sector: string;
  weight: number;
  annualYield: number;
  referencePrice: number;
};

export const funds: Fund[] = [
  {
    name: "Manatí Multiestratégia",
    ticker: "MANA11",
    sector: "Multiestratégia",
    weight: 0.075,
    annualYield: 0.14603691639,
    referencePrice: 10.3,
  },
  {
    name: "BTG CRI",
    ticker: "BTCI11",
    sector: "Papel",
    weight: 0.125,
    annualYield: 0.12810098792,
    referencePrice: 9.58,
  },
  {
    name: "BTG Logística",
    ticker: "BTLG11",
    sector: "Logística",
    weight: 0.125,
    annualYield: 0.09322876967,
    referencePrice: 103.2,
  },
  {
    name: "TRX Real Estate FII",
    ticker: "TRXF11",
    sector: "Híbrido",
    weight: 0.05,
    annualYield: 0.12987012987,
    referencePrice: 99.4,
  },
  {
    name: "Hedge Brasil Shopping",
    ticker: "HGBS11",
    sector: "Shopping",
    weight: 0.1,
    annualYield: 0.098861283644,
    referencePrice: 19.75,
  },
  {
    name: "Pátria Renda Urbana",
    ticker: "HGRU11",
    sector: "Híbrido",
    weight: 0.05,
    annualYield: 0.091187739463,
    referencePrice: 124.55,
  },
  {
    name: "XP Malls",
    ticker: "XPML11",
    sector: "Shopping",
    weight: 0.075,
    annualYield: 0.1056762707,
    referencePrice: 104.8,
  },
  {
    name: "Rio Bravo Renda Corporativa",
    ticker: "RCRB11",
    sector: "Escritórios",
    weight: 0.05,
    annualYield: 0.08749364145,
    referencePrice: 146.2,
  },
  {
    name: "Pátria Escritórios",
    ticker: "HGRE11",
    sector: "Escritórios",
    weight: 0.05,
    annualYield: 0.091545932177,
    referencePrice: 117,
  },
  {
    name: "Pátria VBI Logística",
    ticker: "LVBI11",
    sector: "Logística",
    weight: 0.075,
    annualYield: 0.087032201915,
    referencePrice: 104.35,
  },
  {
    name: "RBR Crédito Estruturado",
    ticker: "RBRY11",
    sector: "Papel",
    weight: 0.075,
    annualYield: 0.15658503554,
    referencePrice: 93.15,
  },
  {
    name: "Mauá Real Estate",
    ticker: "KNHF11",
    sector: "Multiestratégia",
    weight: 0.05,
    annualYield: 0.14601769911,
    referencePrice: 96.5,
  },
  {
    name: "Vectis Juro Real",
    ticker: "VCJR11",
    sector: "Papel",
    weight: 0.1,
    annualYield: 0.14681365958,
    referencePrice: 88.5,
  },
];

export const sectorColors: Record<string, string> = {
  Papel: "#8b5cf6",
  Logística: "#38bdf8",
  Shopping: "#fbbf24",
  Multiestratégia: "#34d399",
  Escritórios: "#94a3b8",
  Híbrido: "#f472b6",
};

export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
