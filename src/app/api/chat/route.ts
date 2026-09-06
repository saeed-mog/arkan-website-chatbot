import { handleChatTurn } from "@/lib/rag/chat";
import { getChatSettings } from "@/lib/rag/config";
import { isRateLimited } from "@/lib/rag/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  let body: { message?: string; conversationId?: string | null; channel?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("بدنه‌ی نامعتبر.", { status: 400 });
  }

  const message = (body.message ?? "").toString().trim();
  if (!message) {
    return new Response("پیام خالی است.", { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response("پیام بیش از حد طولانی است.", { status: 400 });
  }

  // سقف نرخ از پنل خوانده می‌شود و در دیتابیس شمرده می‌شود (نه درون‌حافظه‌ای).
  const settings = await getChatSettings();
  if (await isRateLimited(`chat:${ip}`, settings.rate_limit_per_minute)) {
    return new Response("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  try {
    return await handleChatTurn({
      conversationId: body.conversationId ?? null,
      channel: body.channel ?? "web",
      userMessage: message,
    });
  } catch (e) {
    console.error("[/api/chat] خطا:", (e as Error).message);
    return new Response(
      "در پاسخ‌گویی خطایی رخ داد. لطفاً دوباره تلاش کنید یا فرم درخواست مشاوره را پر کنید.",
      { status: 500 }
    );
  }
}
