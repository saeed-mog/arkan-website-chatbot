import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import ChatSettingsForm from "@/components/admin/ChatSettingsForm";
import { getChatSettings } from "@/lib/rag/config";

export const metadata: Metadata = { title: "تنظیمات چت‌بات", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ChatSettingsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");
  const settings = await getChatSettings();
  return (
    <AdminShell active="chat-settings" role={session.role}>
      <ChatSettingsForm settings={settings} />
    </AdminShell>
  );
}
