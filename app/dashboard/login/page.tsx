import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const u = await getSessionUser({ allowMfaPending: true });
  if (u && !u.mfaPending) redirect("/dashboard");
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="s-panel" style={{ width: "min(440px, 100%)", padding: 28 }}>
        <p className="hand" style={{ fontSize: "1.8rem", margin: 0 }} aria-hidden="true">
          welcome back
        </p>
        <h1 style={{ marginTop: 4 }}>Studio sign-in</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          For the baker and the site owner only. Accounts are created by invitation.
        </p>
        <LoginForm mfaPending={Boolean(u?.mfaPending)} />
      </div>
    </main>
  );
}
