import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { completeText, isOpenRouterConfigured } from "./generate";
import { getModelConfig } from "./config";

/**
 * خلاصه‌ی خودکار گفتگو → ستون conversations.summary
 *
 * چرا لازم است: در پنل و CRM، خواندن ۲۰ پیام برای فهمیدن «این کاربر چه می‌خواست»
 * وقت‌گیر است. خلاصه در لیست گفتگوها و هنگام ارجاع به انسان نشان داده می‌شود.
 *
 * ارزان نگه‌داشتن هزینه: مدل fallback (سبک‌تر) استفاده می‌شود و هر بار
 * اجرا نمی‌شود — فقط هر N پیام یک‌بار، یا هنگام ارجاع به انسان.
 */

const SUMMARY_SYSTEM = `تو خلاصه‌نویس گفتگوهای دستیار فروش شرکت آرکان هستی.
خروجی: حداکثر سه جمله‌ی فارسی، بدون مقدمه و بدون تیتر.
باید مشخص کند: کاربر چه می‌خواست، چه چیزی درباره‌ی کسب‌وکارش گفت، و اقدام بعدی چیست.
اگر اطلاعات تماس داده، اشاره کن. هیچ‌وقت چیزی از خودت اضافه نکن.`;

export async function summarizeConversation(conversationId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isOpenRouterConfigured()) return null;

  const { data: msgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(40);

  if (!msgs || msgs.length === 0) return null;

  const transcript = msgs
    .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${m.content}`)
    .join("\n")
    .slice(0, 8000);

  try {
    const cfg = await getModelConfig("web");
    const summary = await completeText({
      model: cfg.fallback_model || cfg.active_model,
      system: SUMMARY_SYSTEM,
      prompt: `متن گفتگو:\n\n${transcript}`,
      maxOutputTokens: 2000,
    });
    if (!summary) return null;

    await supabase
      .from("conversations")
      .update({ summary: summary.slice(0, 1000) })
      .eq("id", conversationId);
    return summary;
  } catch (e) {
    // خلاصه‌سازی هیچ‌وقت نباید پاسخ کاربر را خراب کند
    console.error("[summarize] خطا:", (e as Error).message);
    return null;
  }
}

/** آیا الان وقت خلاصه‌سازی است؟ (هر N پیام یک‌بار) */
export function shouldSummarize(messageCount: number, everyN: number): boolean {
  if (everyN <= 0) return false;
  return messageCount > 0 && messageCount % everyN === 0;
}
