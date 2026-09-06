import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { embedOne, rerank } from "./embeddings";
import { getEmbeddingConfig, type EmbeddingConfig } from "./config";

export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
  title: string;
};

/**
 * بازیابی: embed سؤال → جست‌وجوی شباهت برداری (match_chunks) → ضمیمه‌کردن عنوان سند.
 * در صورت نبود کلید embedding یا دیتابیس، آرایه‌ی خالی برمی‌گرداند (مغز بدون منبع پاسخ می‌دهد).
 */
export async function retrieve(
  query: string,
  config?: EmbeddingConfig
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const cfg = config ?? (await getEmbeddingConfig());

  let queryVector: number[];
  try {
    queryVector = await embedOne(query, "query", cfg);
  } catch (e) {
    console.error("[retrieve] خطای embedding سؤال:", (e as Error).message);
    return [];
  }

  // با فعال‌بودن reranker عمداً بیشتر می‌گیریم تا بازچینش چیزی برای انتخاب داشته باشد.
  const matchCount = cfg.reranker_enabled ? Math.min(cfg.top_k * 3, 30) : cfg.top_k;

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryVector,
    match_count: matchCount,
    similarity_threshold: cfg.similarity_threshold,
  });

  if (error) {
    console.error("[retrieve] خطای match_chunks:", error.message);
    return [];
  }

  let rows = (data ?? []) as Omit<RetrievedChunk, "title">[];
  if (rows.length === 0) return [];

  // بازچینش (اختیاری) — خطایش نباید کل بازیابی را بخواباند.
  if (cfg.reranker_enabled && rows.length > 1) {
    try {
      const ranked = await rerank(
        query,
        rows.map((r) => r.content),
        cfg.top_k,
        cfg.reranker_model || "rerank-multilingual-v3.0"
      );
      if (ranked.length > 0) {
        rows = ranked.map((r) => ({ ...rows[r.index], similarity: r.score }));
      }
    } catch (e) {
      console.error("[retrieve] خطای rerank:", (e as Error).message);
      rows = rows.slice(0, cfg.top_k);
    }
  }
  rows = rows.slice(0, cfg.top_k);

  // ضمیمه‌کردن عنوان سند
  const docIds = Array.from(new Set(rows.map((r) => r.document_id)));
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", docIds);
  const titleMap = new Map((docs ?? []).map((d) => [d.id, d.title as string]));

  return rows.map((r) => ({
    ...r,
    title: titleMap.get(r.document_id) ?? "سند",
  }));
}

/** سرهم‌کردن متن context از chunkهای بازیابی‌شده برای تزریق به مدل. */
export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c, i) =>
        `[منبع ${i + 1} — «${c.title}»]\n${c.content}`
    )
    .join("\n\n---\n\n");
}
