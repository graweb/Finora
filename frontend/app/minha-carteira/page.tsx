import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { PortfolioManagement } from "@/components/dashboard/portfolio-management";

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="portfolio" />
      <div className="min-h-screen lg:pl-19.5">
        <PortfolioManagement />
      </div>
    </main>
  );
}
