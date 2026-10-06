import "server-only";
import { redirect } from "next/navigation";
import { apiUser, HttpError, requireUser, type SessionUser } from "./session";

// Owner-only areas (accounts, inbox, integrations, export, audit) require two-step sign-in.
export const OWNER_MFA_REQUIRED = process.env.OWNER_MFA_REQUIRED !== "false";

export async function apiOwner(req: Request): Promise<SessionUser> {
  const u = await apiUser(req, "owner");
  if (OWNER_MFA_REQUIRED && !u.totpEnabled) throw new HttpError(403, "Turn on two-step sign-in in Account before using owner tools.");
  return u;
}

export async function pageOwner(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "owner") redirect("/dashboard?denied=1");
  if (OWNER_MFA_REQUIRED && !u.totpEnabled) redirect("/dashboard/account?mfa=required");
  return u;
}
