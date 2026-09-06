import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * محدودیت نرخ درخواست.
 *
 * چرا دیتابیس؟ روی Vercel هر درخواست ممکن است به instance دیگری برسد؛
 * یک Map درون‌حافظه‌ای عملاً هیچ سقفی اعمال نمی‌کند. تابع bump_rate_limit
 * (در chatbot-upgrade.sql) شمارش را اتمیک انجام می‌دهد.
 *
 * لایه‌ی درون‌حافظه‌ای به‌عنوان «خط اول» نگه داشته شده: اگر همان instance
 * سیل درخواست بگیرد، بدون رفت‌وبرگشت به دیتابیس جلویش را می‌گیرد.
 */

const WINDOW_MS = 60_000;
const local = new Map<string, number[]>();

function localCount(key: string): number {
  const now = Date.now();
  const arr = (local.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  local.set(key, arr);
  // جلوگیری از رشد بی‌پایان مپ در instanceهای طولانی‌عمر
  if (local.size > 5000) local.clear();
  return arr.length;
}

/** true یعنی درخواست باید رد شود. */
export async function isRateLimited(key: string, limitPerMinute: number): Promise<boolean> {
  if (limitPerMinute <= 0) return false;
  if (localCount(key) > limitPerMinute) return true;

  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.rpc("bump_rate_limit", {
      p_key: key,
      p_window_seconds: 60,
    });
    if (error) {
      // تابع هنوز اجرا نشده یا خطای موقت ⇒ فقط به لایه‌ی محلی تکیه کن
      console.error("[ratelimit] bump_rate_limit:", error.message);
      return false;
    }
    return typeof data === "number" && data > limitPerMinute;
  } catch (e) {
    console.error("[ratelimit] خطا:", (e as Error).message);
    return false;
  }
}
