import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type RecommendationProgressProps = {
  isProcessing: boolean;
  progress: number;
  remainingFunds: number;
};

export function RecommendationProgress({
  isProcessing,
  progress,
  remainingFunds,
}: RecommendationProgressProps) {
  const isComplete = !isProcessing && progress === 100;
  const title = isProcessing
    ? "Calculando recomendação"
    : isComplete
      ? "Carteira atualizada"
      : "Recomendação de FIIs";
  const description = isProcessing
    ? remainingFunds > 0
      ? `Atualizando ${remainingFunds} FII(s) no Funds Explorer.`
      : "Organizando a melhor carteira para a sua meta."
    : isComplete
      ? "Dados prontos para a sua simulação."
      : "Informe sua meta e clique em Calcular.";
  const Icon = isProcessing ? LoaderCircle : isComplete ? CheckCircle2 : Sparkles;

  return (
    <Card className="mb-5 min-h-[132px] border-sky-400/25 bg-[#222153] py-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Icon
                className={`size-4 text-sky-400 ${
                  isProcessing ? "animate-spin" : ""
                }`}
              />
              {title}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{description}</p>
          </div>
          <span className="text-sm font-semibold text-sky-300">
            {progress}%
          </span>
        </div>
        <div
          aria-label="Progresso do cálculo da recomendação"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-sky-400 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
