"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FundManagement } from "./fund-management";
import { InvestmentPolicySettings } from "./investment-policy-settings";
import { IntegrationsSettings } from "./integrations-settings";
import { PageHeader } from "./page-header";
import { useSidebarTabReset } from "./sidebar-tab-reset";

export function SettingsManagement() {
  const [activeTab, setActiveTab] = useState<"funds" | "policy" | "integrations">("funds");
  useSidebarTabReset(() => setActiveTab("funds"));
  return (
    <section className="min-w-0 p-5 pt-20 sm:p-7 sm:pt-20 lg:p-8">
      <PageHeader
        title="Configurações"
        description="Personalize como o Finora avalia e sugere sua carteira."
      />
      <div className="relative mt-5">
        <div className="inline-flex rounded-lg border border-[#4a4880] bg-[#222153] p-1">
          <Button
            className={
              activeTab === "funds"
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                : "text-zinc-300 hover:bg-[#302e67] hover:text-white"
            }
            variant={activeTab === "funds" ? "default" : "ghost"}
            onClick={() => setActiveTab("funds")}
          >
            Fundos imobiliários
          </Button>
          <Button
            className={
              activeTab === "policy"
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                : "text-zinc-300 hover:bg-[#302e67] hover:text-white"
            }
            variant={activeTab === "policy" ? "default" : "ghost"}
            onClick={() => setActiveTab("policy")}
          >
            Política de investimento
          </Button>
          <Button
            className={
              activeTab === "integrations"
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                : "text-zinc-300 hover:bg-[#302e67] hover:text-white"
            }
            variant={activeTab === "integrations" ? "default" : "ghost"}
            onClick={() => setActiveTab("integrations")}
          >
            Integrações
          </Button>
        </div>
        {activeTab === "funds" ? <FundManagement embedded /> : null}
        {activeTab === "policy" ? <InvestmentPolicySettings /> : null}
        {activeTab === "integrations" ? <IntegrationsSettings /> : null}
      </div>
    </section>
  );
}
