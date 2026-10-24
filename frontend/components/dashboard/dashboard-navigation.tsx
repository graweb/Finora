"use client";

import { useState } from "react";
import { Calculator, ChartPie, Home, Menu, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

type DashboardView = "dashboard" | "portfolio" | "funds" | "financial";

type DashboardNavigationProps = {
  activeView: DashboardView;
};

const navigationItems = [
  { href: "/", icon: Home, label: "Dashboard", view: "dashboard" },
  {
    href: "/minha-carteira",
    icon: ChartPie,
    label: "Minha carteira",
    view: "portfolio",
  },
  {
    href: "/fundos",
    icon: WalletCards,
    label: "Fundos imobiliários",
    view: "funds",
  },
  {
    href: "/movimentacoes",
    icon: Calculator,
    label: "Controle financeiro",
    view: "financial",
  },
] as const;

export function DashboardNavigation({ activeView }: DashboardNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        aria-controls="mobile-sidebar"
        aria-expanded={isMobileMenuOpen}
        className="fixed top-4 left-4 z-50 grid size-10 place-items-center rounded-lg border border-[#4a4880] bg-[#242351] text-white shadow-lg lg:hidden"
        onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
      >
        {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {isMobileMenuOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-[#0e0d2c]/70 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        id="mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#242351] p-5 shadow-2xl transition-transform duration-200 lg:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <p className="mt-16 text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
          Finora
        </p>
        <nav className="mt-6 grid gap-2" aria-label="Navegação principal">
          {navigationItems.map(({ href, icon: Icon, label, view }) => (
            <Link
              href={href}
              className={buttonVariants({
                variant: "ghost",
                className: `h-11 justify-start gap-3 px-3 ${
                  activeView === view
                    ? "bg-[#302e67] text-sky-400 hover:bg-[#302e67] hover:text-sky-300"
                    : "text-zinc-200 hover:bg-[#302e67] hover:text-white"
                }`,
              })}
              key={href}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <nav className="fixed inset-y-0 left-0 z-20 hidden w-19.5 items-center justify-center bg-[#242351] lg:flex">
        <div className="flex flex-col gap-7">
          {navigationItems.map(({ href, icon: Icon, label, view }) => (
            <Link
              href={href}
              aria-label={label}
              className={buttonVariants({
                size: "icon",
                variant: "ghost",
                className:
                  activeView === view ? "text-sky-400" : "text-zinc-300",
              })}
              key={href}
            >
              <Icon className="size-6" />
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
