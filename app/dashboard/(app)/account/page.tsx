import { requireUser } from "@/lib/auth/session";
import { MfaForm, PasswordForm, SignOutButton } from "@/components/dashboard/AccountForms";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const user = await requireUser();
  const { mfa } = await searchParams;
  return (
    <>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Account</h1>
        <SignOutButton />
      </div>
      <p className="muted">
        {user.displayName} · {user.email} · {user.role === "owner" ? "Owner" : "Baker / author"}
      </p>
      {mfa === "required" ? (
        <p className="alert alert-info" role="alert">
          Owner tools need two-step sign-in. Set it up below — it takes about a minute.
        </p>
      ) : null}
      <section className="s-panel">
        <h2>Two-step sign-in</h2>
        <p className="hint">{user.role === "owner" ? "Required for the owner account." : "Recommended."} After your password, you’ll enter a code from your phone.</p>
        <MfaForm enabled={user.totpEnabled} />
      </section>
      <section className="s-panel">
        <h2>Password</h2>
        <PasswordForm />
      </section>
    </>
  );
}
