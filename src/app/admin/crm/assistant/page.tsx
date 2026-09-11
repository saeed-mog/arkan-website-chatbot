import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import CrmAssistant from "@/components/admin/crm/CrmAssistant";

export const metadata: Metadata = { title: "دستیار CRM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CrmAssistantPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell active="assistant" role={session.role}>
      <CrmAssistant />
    </AdminShell>
  );
}
