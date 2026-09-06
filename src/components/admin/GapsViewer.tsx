"use client";

import { useState, useTransition } from "react";
import { toFa } from "@/lib/utils";
import { resolveGapAction, deleteGapAction } from "@/app/admin/chatbot-actions";

export type GapRow = {
  id: string;
  channel: string;
  question: string;
  top_similarity: number | null;
  resolved: boolean;
  created_at: string;
  conversation_id: string | null;
};

const CHANNEL_LABEL: Record<string, string> = { web: "صفحه‌ی چت", widget: "ویجت", telegram: "تلگرام" };

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * سؤال‌هایی که چت‌بات منبع مرتبطی برایشان پیدا نکرد.
 * این فهرست، فهرستِ کارِ پایگاه دانش است: هر ردیف یعنی یک سند یا پاراگراف کم داریم.
 */
export default function GapsViewer({ gaps, error }: { gaps: GapRow[]; error: string | null }) {
  const [rows, setRows] = useState(gaps);
  const [showResolved, setShowResolved] = useState(false);
  const [, start] = useTransition();

  const visible = rows.filter((g) => (showResolved ? true : !g.resolved));
  const openCount = rows.filter((g) => !g.resolved).length;

  function toggleResolved(g: GapRow) {
    setRows((r) => r.map((x) => (x.id === g.id ? { ...x, resolved: !x.resolved } : x)));
    start(async () => {
      await resolveGapAction(g.id, !g.resolved);
    });
  }

  function remove(g: GapRow) {
    setRows((r) => r.filter((x) => x.id !== g.id));
    start(async () => {
      await deleteGapAction(g.id);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">سؤال‌های بی‌پاسخ</h1>
        <p className="mt-1 text-caption text-slate">
          سؤال‌هایی که بازیابی برایشان منبع مرتبطی پیدا نکرد. هر ردیف یعنی پایگاه دانش یک شکاف دارد —
          سند مربوطه را در «پایگاه دانش» اضافه کنید و ردیف را رفع‌شده علامت بزنید.
        </p>
      </div>

      {error && <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-slate">{toFa(openCount)} مورد رسیدگی‌نشده</p>
        <label className="flex items-center gap-2 text-caption text-slate">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="h-4 w-4 accent-pine"
          />
          نمایش موارد رفع‌شده
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-sand bg-white px-5 py-12 text-center text-slate">
          موردی برای نمایش نیست — یعنی چت‌بات برای همه‌ی سؤال‌های اخیر منبع داشته است.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((g) => (
            <div
              key={g.id}
              className={`rounded-card border bg-white px-5 py-4 shadow-soft ${g.resolved ? "border-sand opacity-60" : "border-sand"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="flex-1 text-[0.95rem] leading-7 text-ink">{g.question}</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleResolved(g)}
                    className="rounded-btn border border-sand px-3 py-1.5 text-caption text-pine transition-colors hover:bg-bone"
                  >
                    {g.resolved ? "بازکردن" : "رفع شد"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(g)}
                    className="rounded-btn border border-sand px-3 py-1.5 text-caption text-slate transition-colors hover:text-red-600"
                  >
                    حذف
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.75rem] text-slate">
                <span className="rounded-full bg-sand px-2.5 py-0.5 text-pine">{CHANNEL_LABEL[g.channel] ?? g.channel}</span>
                <span>{fmt(g.created_at)}</span>
                <span>
                  ·{" "}
                  {g.top_similarity == null
                    ? "هیچ منبعی بازیابی نشد"
                    : `بهترین شباهت: ${toFa(Math.round(g.top_similarity * 100))}٪`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
