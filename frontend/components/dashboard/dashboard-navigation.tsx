import {
  Calculator,
  Home,
  Layers3,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

type DashboardView = "dashboard" | "funds" | "financial";

type DashboardNavigationProps = {
  activeView: DashboardView;
};

export function DashboardNavigation({ activeView }: DashboardNavigationProps) {
  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-19.5 items-center justify-center bg-[#242351] lg:flex">
      <div className="flex flex-col gap-7">
        <Link
          href="/"
          aria-label="Dashboard"
          className={buttonVariants({
            size: "icon",
            variant: "ghost",
            className:
              activeView === "dashboard" ? "text-sky-400" : "text-zinc-300",
          })}
        >
          <Home />
        </Link>
        <Link
          href="/fundos"
          aria-label="Fundos imobiliários"
          className={buttonVariants({
            size: "icon",
            variant: "ghost",
            className:
              activeView === "funds" ? "text-sky-400" : "text-zinc-300",
          })}
        >
          <WalletCards />
        </Link>
        <Link
          href="/movimentacoes"
          aria-label="Controle financeiro"
          className={buttonVariants({
            size: "icon",
            variant: "ghost",
            className:
              activeView === "financial" ? "text-sky-400" : "text-zinc-300",
          })}
        >
          <Calculator />
        </Link>
        <Button size="icon" variant="ghost">
          <Layers3 />
        </Button>
        <Button size="icon" variant="ghost">
          <SlidersHorizontal />
        </Button>
      </div>
    </nav>
  );
}
