import "server-only";
import { generateText, streamText, stepCountIs, type ToolSet } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * لایه‌ی تولید پاسخ — همه‌ی مدل‌ها از طریق OpenRouter (فرمت OpenAI-compatible، استریمی).
 * تعویض مدل فقط تغییر یک slug است.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function getOpenRouter() {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    headers: {
      // برای رتبه‌بندی OpenRouter (اختیاری)
      "HTTP-Referer": "https://arkan-website-chatbot.vercel.app",
      "X-Title": "Arkan Consultant",
    },
    // محدودکردن reasoning به سطح پایین برای همه‌ی مدل‌ها.
    // برخی مدل‌ها (مثل Gemini 3.5 Flash) reasoning اجباری دارند و در غیر این صورت ممکن است
    // کل بودجه‌ی توکن را صرف استدلال کنند و متنی تولید نکنند («No output generated»).
    // effort=low استدلال را کوتاه می‌کند تا همیشه برای پاسخ متنی جا بماند (و سریع‌تر/ارزان‌تر است).
    fetch: (async (url: string, options: RequestInit | undefined) => {
      if (options?.body && typeof options.body === "string") {
        try {
          const body = JSON.parse(options.body);
          body.reasoning = { effort: "low" };
          options = { ...options, body: JSON.stringify(body) };
        } catch {
          /* اگر بدنه JSON نبود، دست‌نخورده بماند */
        }
      }
      return fetch(url, options);
    }) as typeof fetch,
  });
}

export type StreamChatOptions = {
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  tools?: ToolSet;
  onFinish?: (event: {
    text: string;
    usage: { inputTokens?: number; outputTokens?: number } | undefined;
    model: string;
  }) => void | Promise<void>;
};

export function streamChat(opts: StreamChatOptions) {
  const openrouter = getOpenRouter();

  return streamText({
    model: openrouter(opts.model),
    system: opts.system,
    messages: opts.messages,
    temperature: opts.temperature,
    topP: opts.topP,
    maxOutputTokens: opts.maxOutputTokens,
    tools: opts.tools,
    // اجازه‌ی چند گام تا مدل بعد از اجرای ابزار، پاسخ نهایی متنی بدهد
    stopWhen: stepCountIs(5),
    onFinish: async (event) => {
      if (opts.onFinish) {
        await opts.onFinish({
          text: event.text,
          usage: {
            inputTokens: event.usage?.inputTokens,
            outputTokens: event.usage?.outputTokens,
          },
          model: opts.model,
        });
      }
    },
  });
}

/** تولید متن یک‌باره (بدون استریم) — برای کارهای پس‌زمینه مثل خلاصه‌سازی. */
export async function completeText(opts: {
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const openrouter = getOpenRouter();
  const { text } = await generateText({
    model: openrouter(opts.model),
    system: opts.system,
    prompt: opts.prompt,
    temperature: opts.temperature ?? 0.3,
    maxOutputTokens: opts.maxOutputTokens ?? 2000,
  });
  return text.trim();
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
