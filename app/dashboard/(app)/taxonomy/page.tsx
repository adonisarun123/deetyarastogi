import { requireUser } from "@/lib/auth/session";
import { TaxonomyManager } from "@/components/dashboard/TaxonomyManager";

export const metadata = { title: "Categories & tags" };

export default async function TaxonomyPage() {
  await requireUser();
  return (
    <>
      <h1>Categories &amp; tags</h1>
      <TaxonomyManager />
    </>
  );
}
