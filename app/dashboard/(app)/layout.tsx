import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/site";
import { StudioNav } from "@/components/dashboard/StudioNav";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <div className="studio-shell">
      <StudioNav brand={settings.brandName} user={{ name: user.displayName, role: user.role }} />
      <main className="studio-main" id="main">
        {children}
      </main>
    </div>
  );
}
