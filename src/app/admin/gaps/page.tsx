import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import GapsViewer, { type GapRow } from "@/components/admin/GapsViewer";

export const metadata: Metadata = { title: "سؤال‌های بی‌پاسخ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function GapsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let gaps: GapRow[] = [];
  let error: string | null = null;

  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const { data, error: e } = await supabase
      .from("unanswered_questions")
      .select("id, channel, question, top_similarity, resolved, created_at, conversation_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (e) error = `${e.message} — آیا chatbot-upgrade.sql را اجرا کرده‌اید؟`;
    else gaps = (data as GapRow[]) ?? [];
  }

  return (
    <AdminShell active="gaps" role={session.role}>
      <GapsViewer gaps={gaps} error={error} />
    </AdminShell>
  );
}
