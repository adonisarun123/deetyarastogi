import { requireUser } from "@/lib/auth/session";
import { MediaLibrary } from "@/components/dashboard/MediaLibrary";

export const metadata = { title: "Photos" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireUser();
  const { filter } = await searchParams;
  return (
    <>
      <h1>Photos</h1>
      <p className="muted">Originals stay private. Only resized web copies (with location data removed) appear on the site, and only once an entry using them is published.</p>
      <MediaLibrary initialFilter={filter === "failed" || filter === "unused" ? filter : ""} />
    </>
  );
}
