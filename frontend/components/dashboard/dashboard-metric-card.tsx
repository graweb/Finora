import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DashboardMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
};

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: DashboardMetricCardProps) {
  return (
    <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
      <CardContent className="flex min-h-24.5 items-center gap-3 p-4">
        <span className="grid size-9 place-items-center rounded-lg bg-[#2d2b62] text-sky-400">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-zinc-300">{label}</p>
          <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
