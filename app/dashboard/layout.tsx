import type { Metadata } from "next";
import "./dashboard.css";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function DashboardRoot({ children }: { children: React.ReactNode }) {
  return <div className="studio">{children}</div>;
}
