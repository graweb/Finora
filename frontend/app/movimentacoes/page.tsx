import { FinancialManagement } from "@/components/dashboard/financial-management";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";

export default function FinancialMovementsPage() {
  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="financial" />
      <div className="min-h-screen lg:pl-19.5">
        <FinancialManagement />
      </div>
    </main>
  );
}
