import { requireUser } from "@/lib/auth/session";
import { getProfile, listExperiences } from "@/lib/site";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export const metadata = { title: "Profile & journey" };

export default async function ProfilePage() {
  await requireUser();
  const [profile, experiences] = await Promise.all([getProfile(), listExperiences(false)]);
  return (
    <>
      <h1>Profile &amp; journey</h1>
      <ProfileForm initial={profile} experiences={experiences} />
    </>
  );
}
