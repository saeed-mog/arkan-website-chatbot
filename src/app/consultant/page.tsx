import type { Metadata } from "next";
import ChatPanel from "@/components/chat/ChatPanel";
import { getWidgetConfig } from "@/lib/rag/widget";

export const metadata: Metadata = {
  title: "گفت‌وگو با مشاور آرکان",
  description:
    "از دستیار هوشمند آرکان درباره‌ی خدمات، متدولوژی چهار رکن و فرایند همکاری بپرسید و مسیر رشد کسب‌وکارتان را روشن کنید.",
};

export const dynamic = "force-dynamic";

export default async function ConsultantPage() {
  // سؤال‌های پیشنهادی از همان تنظیماتی می‌آیند که ویجت استفاده می‌کند.
  const cfg = await getWidgetConfig();
  return <ChatPanel starters={cfg.suggested_questions} />;
}
