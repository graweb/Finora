import { FundManagement } from "@/components/dashboard/fund-management";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";

export default function InvestmentFundsPage() {
  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="funds" />
      <div className="min-h-screen lg:pl-19.5">
        <FundManagement />
      </div>
    </main>
  );
}
