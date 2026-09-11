import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import ModelSettings from "@/components/admin/ModelSettings";
import { getAllModelConfigs, getEmbeddingConfig } from "@/lib/rag/config";

export const metadata: Metadata = { title: "مدل‌ها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  if (!await isAuthed()) redirect("/admin/login");
  const [models, embedding] = await Promise.all([getAllModelConfigs(), getEmbeddingConfig()]);
  return (
    <AdminShell active="models">
      <ModelSettings models={models} embedding={embedding} />
    </AdminShell>
  );
}
