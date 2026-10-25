import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { SettingsManagement } from "@/components/dashboard/settings-management";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#181642] text-zinc-100">
      <DashboardNavigation activeView="settings" />
      <div className="min-h-screen lg:pl-19.5">
        <SettingsManagement />
      </div>
    </main>
  );
}
