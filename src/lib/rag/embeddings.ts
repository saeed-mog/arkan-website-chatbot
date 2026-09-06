import "server-only";
import type { EmbeddingConfig } from "./config";

/**
 * تبدیل متن به بردار (embedding) — provider-agnostic.
 * در Milestone 1 فقط Cohere پیاده شده؛ ساختار برای افزودن OpenAI/Google/Voyage آماده است.
 *
 * inputType:
 *   - 'query'    → برای embed کردن سؤال کاربر هنگام جست‌وجو
 *   - 'document' → برای embed کردن chunkهای پایگاه دانش
 */
export type EmbedInputType = "query" | "document";

export async function embed(
  texts: string[],
  inputType: EmbedInputType,
  config: EmbeddingConfig
): Promise<number[][]> {
  if (texts.length === 0) return [];

  switch (config.provider) {
    case "cohere":
      return embedCohere(texts, inputType, config);
    default:
      throw new Error(
        `ارائه‌دهنده‌ی embedding پشتیبانی‌نشده در این نسخه: ${config.provider}`
      );
  }
}

async function embedCohere(
  texts: string[],
  inputType: EmbedInputType,
  config: EmbeddingConfig
): Promise<number[][]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "کلید COHERE_API_KEY تنظیم نشده است؛ امکان ساخت embedding وجود ندارد."
    );
  }

  const res = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      texts,
      input_type: inputType === "query" ? "search_query" : "search_document",
      embedding_types: ["float"],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`خطای Cohere (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  // فرمت پاسخ Cohere v2: { embeddings: { float: number[][] } }
  const vectors: number[][] | undefined = json?.embeddings?.float;
  if (!vectors || !Array.isArray(vectors)) {
    throw new Error("پاسخ Cohere فاقد بردارهای معتبر بود.");
  }
  return vectors;
}

/** embed یک متن تکی (کمکی). */
export async function embedOne(
  text: string,
  inputType: EmbedInputType,
  config: EmbeddingConfig
): Promise<number[]> {
  const [vec] = await embed([text], inputType, config);
  return vec;
}

/**
 * بازچینش (rerank) نتایج بازیابی با Cohere Rerank.
 * جست‌وجوی برداری «شبیه‌ترین» را می‌آورد؛ reranker «مرتبط‌ترین» را انتخاب می‌کند
 * و معمولاً دقت پاسخ‌ها را محسوس بالا می‌برد.
 * خروجی: ایندکس‌های documents به ترتیب ارتباط (طول ≤ topN).
 */
export async function rerank(
  query: string,
  documents: string[],
  topN: number,
  model: string
): Promise<{ index: number; score: number }[]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey || documents.length === 0) return [];

  const res = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "rerank-multilingual-v3.0",
      query,
      documents,
      top_n: Math.min(topN, documents.length),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`خطای Cohere Rerank (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const results = json?.results;
  if (!Array.isArray(results)) return [];
  return results.map((r: { index: number; relevance_score: number }) => ({
    index: r.index,
    score: r.relevance_score,
  }));
}
