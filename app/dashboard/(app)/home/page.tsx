import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/site";
import { HomeSettingsForm } from "@/components/dashboard/HomeSettingsForm";

export const metadata = { title: "Homepage" };

export default async function HomeSettingsPage() {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <>
      <h1>Homepage</h1>
      <HomeSettingsForm initial={settings} isOwner={user.role === "owner"} />
    </>
  );
}
