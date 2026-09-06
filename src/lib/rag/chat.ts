import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { leadSchema } from "@/lib/validation";
import { retrieve, buildContext } from "./retrieve";
import { getModelConfig, getActivePrompt, getChatSettings, type ChatSettings } from "./config";
import { streamChat, isOpenRouterConfigured, type ChatMessage } from "./generate";
import {
  looksLikeInjection,
  INJECTION_REPLY,
  INJECTION_GUARD_NOTE,
  isWithinOfficeHours,
  maskPII,
  extractContactHint,
} from "./policy";
import { summarizeConversation, shouldSummarize } from "./summarize";

/**
 * مغز مرکزی چت‌بات — مستقل از کانال.
 * - handleChatTurn → پاسخ استریمی (وب/ویجت)
 * - getReplyText   → پاسخ متنی کامل (تلگرام و کانال‌های غیراستریمی)
 * هر دو از prepareTurn مشترک استفاده می‌کنند.
 */

const HISTORY_LIMIT = 12;
const NOT_CONFIGURED =
  "سرویس گفتگو هنوز پیکربندی نشده است. لطفاً کمی بعد دوباره امتحان کنید یا فرم درخواست مشاوره را پر کنید.";
const CONV_LIMIT_REPLY =
  "این گفتگو طولانی شده است. لطفاً گفتگوی جدیدی شروع کنید یا درخواست مشاوره‌ی رایگان ثبت کنید تا همکاران ما مستقیم پیگیری کنند.";

// زیر این حد، بازیابی را «ضعیف» می‌شماریم و سؤال را در شکاف‌های دانش ثبت می‌کنیم.
const WEAK_RETRIEVAL_SCORE = 0.4;

export type ChatTurnInput = {
  conversationId?: string | null;
  channel?: string;
  externalUserId?: string | null;
  userMessage: string;
};

type Source = { title: string; similarity: number; chunk_index: number };
type PreparedTurn = {
  result: ReturnType<typeof streamChat> | null;
  conversationId: string | null;
  sources: Source[];
  fallbackText?: string;
};

async function prepareTurn(input: ChatTurnInput): Promise<PreparedTurn> {
  const supabase = getSupabaseAdmin();
  const channel = input.channel ?? "web";
  const settings = await getChatSettings();

  if (!isOpenRouterConfigured()) {
    return { result: null, conversationId: input.conversationId ?? null, sources: [], fallbackText: NOT_CONFIGURED };
  }

  // ۱) conversation
  let conversationId = input.conversationId ?? null;
  let messageCount = 0;

  if (supabase) {
    if (!conversationId) {
      const { data } = await supabase
        .from("conversations")
        .insert({ channel, status: "open", external_user_id: input.externalUserId ?? null })
        .select("id")
        .single();
      conversationId = data?.id ?? null;
    } else {
      await supabase.from("conversations").update({ last_at: new Date().toISOString() }).eq("id", conversationId);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);
      messageCount = count ?? 0;
    }

    // سقف پیام در یک گفتگو — جلوگیری از مصرف بی‌پایان توکن روی یک نشست
    if (settings.max_messages_per_conv > 0 && messageCount >= settings.max_messages_per_conv) {
      await persistCannedTurn(supabase, conversationId, input.userMessage, CONV_LIMIT_REPLY);
      return { result: null, conversationId, sources: [], fallbackText: CONV_LIMIT_REPLY };
    }

    if (conversationId) {
      await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: input.userMessage });
      messageCount += 1;
    }
  }

  // ۲) محافظ تزریق پرامپت — قبل از صدازدن مدل (هم امن‌تر، هم ارزان‌تر)
  if (settings.injection_guard_enabled && looksLikeInjection(input.userMessage)) {
    if (supabase && conversationId) {
      await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: INJECTION_REPLY });
    }
    console.warn("[chat] تلاش برای تزریق پرامپت:", maskPII(input.userMessage).slice(0, 200));
    return { result: null, conversationId, sources: [], fallbackText: INJECTION_REPLY };
  }

  // ۳) تاریخچه
  let history: ChatMessage[] = [];
  if (supabase && conversationId) {
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT * 2);
    history = (data ?? [])
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }
  if (history.length === 0 || history[history.length - 1].content !== input.userMessage) {
    history.push({ role: "user", content: input.userMessage });
  }

  // ۴) بازیابی RAG
  const chunks = await retrieve(input.userMessage);
  const context = buildContext(chunks);
  const retrievedChunkIds = chunks.map((c) => c.id);

  // ثبت شکاف دانش: سؤالی که منبع مرتبطی برایش پیدا نشد
  const topScore = chunks.length ? Math.max(...chunks.map((c) => c.similarity)) : null;
  if (supabase && (chunks.length === 0 || (topScore ?? 0) < WEAK_RETRIEVAL_SCORE)) {
    await logKnowledgeGap(supabase, conversationId, channel, input.userMessage, topScore, settings);
  }

  // ۵) system prompt + context + سیاست‌ها
  const basePrompt = await getActivePrompt();
  const parts = [basePrompt];

  if (settings.injection_guard_enabled) parts.push(INJECTION_GUARD_NOTE);

  if (!isWithinOfficeHours(settings)) {
    parts.push(
      `# وضعیت زمانی\nالان خارج از ساعت کاری آرکان است. در اولین پاسخ این پیام را با لحن خودت منتقل کن: «${settings.offline_message}»`
    );
  }

  if (settings.handoff_enabled) {
    parts.push(
      "# تحویل به انسان\nاگر کاربر صراحتاً خواست با یک انسان صحبت کند، شکایتی داشت، یا دو بار پشت‌سرهم نتوانستی پاسخ درستی بدهی، ابزار request_human را صدا بزن."
    );
  }

  parts.push(
    context
      ? `# منابع بازیابی‌شده\nبرای پاسخ فقط از منابع زیر استفاده کن. اگر پاسخ در این منابع نبود، صادقانه بگو و کاربر را به ثبت درخواست مشاوره دعوت کن.\n\n${context}`
      : "(در پایگاه دانش منبع مرتبطی یافت نشد. اگر مطمئن نیستی، صادقانه بگو و کاربر را به «ثبت درخواست مشاوره» دعوت کن.)"
  );

  const system = parts.join("\n\n");

  // ۶) مدل + ابزار
  const modelCfg = await getModelConfig(channel);
  const tools = buildTools(supabase, conversationId, settings);
  const countAfterTurn = messageCount + 1; // پیام کاربر + پاسخ دستیار

  // ۷) تولید استریمی (با persist در onFinish)
  const result = streamChat({
    model: modelCfg.active_model,
    system,
    messages: history,
    temperature: modelCfg.temperature,
    topP: modelCfg.top_p,
    maxOutputTokens: modelCfg.max_tokens,
    tools,
    onFinish: async ({ text, usage, model }) => {
      if (!supabase || !conversationId || !text) return;
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: text,
        model_used: model,
        tokens_in: usage?.inputTokens ?? null,
        tokens_out: usage?.outputTokens ?? null,
        retrieved_chunk_ids: retrievedChunkIds.length ? retrievedChunkIds : null,
      });

      // خلاصه‌ی خودکار هر N پیام — برای پنل و CRM
      if (settings.summary_enabled && shouldSummarize(countAfterTurn, settings.summary_every_n_messages)) {
        await summarizeConversation(conversationId);
      }
    },
  });

  const sources: Source[] = chunks.map((c) => ({
    title: c.title,
    similarity: Math.round(c.similarity * 100) / 100,
    chunk_index: c.chunk_index,
  }));

  return { result, conversationId, sources };
}

/** پاسخ استریمی (وب/ویجت). متادیتا در هدر x-arkan-meta (base64). */
export async function handleChatTurn(input: ChatTurnInput): Promise<Response> {
  const p = await prepareTurn(input);
  if (!p.result) return fallbackResponse(p.fallbackText ?? NOT_CONFIGURED, p.conversationId);
  return p.result.toTextStreamResponse({
    headers: { "x-arkan-meta": toBase64({ conversationId: p.conversationId, sources: p.sources }) },
  });
}

/** پاسخ متنی کامل (تلگرام و کانال‌های غیراستریمی). */
export async function getReplyText(
  input: ChatTurnInput
): Promise<{ text: string; conversationId: string | null; sources: Source[] }> {
  const p = await prepareTurn(input);
  if (!p.result) return { text: p.fallbackText ?? NOT_CONFIGURED, conversationId: p.conversationId, sources: [] };
  const text = await p.result.text;
  return { text: text || "—", conversationId: p.conversationId, sources: p.sources };
}

// ── ابزارها ─────────────────────────────────────────────────────
function buildTools(
  supabase: SupabaseClient<any, any, any> | null,
  conversationId: string | null,
  settings: ChatSettings
): ToolSet {
  const tools: ToolSet = {
    capture_lead: tool({
      description:
        "ثبت «درخواست مشاوره» وقتی کاربر اطلاعات لازم را داده و آماده‌ی مشاوره است. فقط وقتی صدا بزن که حداقل نام، شماره تماس، نام کسب‌وکار، مرحله و چالش مشخص باشد.",
      inputSchema: z.object({
        full_name: z.string().describe("نام و نام خانوادگی کاربر"),
        phone: z.string().describe("شماره تماس کاربر"),
        business_name: z.string().describe("نام کسب‌وکار"),
        stage: z.enum(["ایده", "نوپا", "در حال رشد", "تثبیت‌شده"]).describe("مرحله‌ی کسب‌وکار"),
        challenge: z.string().describe("بزرگ‌ترین چالش فعلی کاربر"),
        email: z.string().optional().describe("ایمیل (اختیاری)"),
        industry: z.string().optional().describe("حوزه‌ی فعالیت (اختیاری)"),
        preferred_time: z.enum(["صبح", "بعدازظهر", "عصر"]).optional().describe("زمان مناسب تماس (اختیاری)"),
      }),
      execute: async (args) => {
        if (!supabase) return { ok: false, message: "ثبت موقتاً ممکن نیست." };
        const parsed = leadSchema.safeParse(args);
        if (!parsed.success) return { ok: false, message: "اطلاعات کامل یا معتبر نیست؛ از کاربر تکمیلش را بخواه." };
        const d = parsed.data;
        const { error } = await supabase.from("leads").insert({
          full_name: d.full_name,
          phone: d.phone,
          email: d.email || null,
          business_name: d.business_name,
          industry: d.industry || null,
          stage: d.stage,
          challenge: d.challenge,
          preferred_time: d.preferred_time || null,
          status: "new",
          source: "chatbot",
          conversation_id: conversationId,
        });
        if (error) {
          console.error("[capture_lead] خطا:", error.message);
          return { ok: false, message: "در ثبت خطایی رخ داد." };
        }
        return { ok: true, message: "درخواست مشاوره با موفقیت ثبت شد. تیم آرکان ظرف ۲۴ ساعت کاری تماس می‌گیرد." };
      },
    }),
  };

  // تحویل به انسان — گفتگو را در پنل با وضعیت «نیازمند انسان» علامت می‌زند.
  if (settings.handoff_enabled) {
    tools.request_human = tool({
      description:
        "ارجاع گفتگو به همکار انسانی آرکان. وقتی صدا بزن که کاربر صریحاً درخواست انسان کرد، شکایت یا نارضایتی داشت، یا سؤالش خارج از توان توست.",
      inputSchema: z.object({
        reason: z.string().describe("در یک جمله: چرا این گفتگو به انسان نیاز دارد"),
        contact: z.string().optional().describe("شماره تماس یا ایمیلی که کاربر داده (اگر داده)"),
      }),
      execute: async ({ reason, contact }) => {
        if (!supabase || !conversationId) {
          return { ok: false, message: "ثبت ارجاع ممکن نشد؛ از کاربر بخواه فرم درخواست مشاوره را پر کند." };
        }
        const { error } = await supabase
          .from("conversations")
          .update({
            status: "needs_human",
            escalated_at: new Date().toISOString(),
            escalation_reason: reason.slice(0, 500),
            contact_hint: contact ? extractContactHint(contact) ?? contact.slice(0, 100) : null,
          })
          .eq("id", conversationId);
        if (error) {
          console.error("[request_human] خطا:", error.message);
          return { ok: false, message: "ثبت ارجاع ممکن نشد." };
        }
        await summarizeConversation(conversationId);
        return { ok: true, message: settings.handoff_message };
      },
    });
  }

  return tools;
}

// ── کمکی‌ها ─────────────────────────────────────────────────────
async function logKnowledgeGap(
  supabase: SupabaseClient<any, any, any>,
  conversationId: string | null,
  channel: string,
  question: string,
  topScore: number | null,
  settings: ChatSettings
): Promise<void> {
  const text = settings.pii_masking_enabled ? maskPII(question) : question;
  const { error } = await supabase.from("unanswered_questions").insert({
    conversation_id: conversationId,
    channel,
    question: text.slice(0, 1000),
    top_similarity: topScore,
  });
  // جدول ممکن است هنوز ساخته نشده باشد ⇒ گفتگو نباید بخوابد
  if (error) console.error("[knowledge-gap]", error.message);
}

/** ثبت یک دور کامل (پیام کاربر + پاسخ آماده) وقتی مدل اصلاً صدا زده نمی‌شود. */
async function persistCannedTurn(
  supabase: SupabaseClient<any, any, any>,
  conversationId: string | null,
  userMessage: string,
  reply: string
): Promise<void> {
  if (!conversationId) return;
  await supabase.from("messages").insert([
    { conversation_id: conversationId, role: "user", content: userMessage },
    { conversation_id: conversationId, role: "assistant", content: reply },
  ]);
}

function fallbackResponse(message: string, conversationId: string | null = null): Response {
  return new Response(message, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-arkan-meta": toBase64({ conversationId, sources: [] }),
    },
  });
}

function toBase64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf-8").toString("base64");
}
