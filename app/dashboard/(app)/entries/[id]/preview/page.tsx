import { PreviewFrame } from "./PreviewFrame";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Preview" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  return <PreviewFrame id={id} />;
}
