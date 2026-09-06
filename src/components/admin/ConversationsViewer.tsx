"use client";

import { useState, useTransition } from "react";
import { toFa } from "@/lib/utils";
import {
  getConversationDetailAction,
  setConversationStatusAction,
  summarizeConversationAction,
  type ConvMessage,
} from "@/app/admin/chatbot-actions";

export type ConvRow = {
  id: string;
  channel: string;
  status: string;
  summary: string | null;
  escalation_reason: string | null;
  contact_hint: string | null;
  escalated_at: string | null;
  started_at: string;
  last_at: string;
};

const CHANNEL_LABEL: Record<string, string> = { web: "صفحه‌ی چت", widget: "ویجت", telegram: "تلگرام" };
const STATUS_LABEL: Record<string, string> = { open: "باز", needs_human: "نیازمند انسان", closed: "بسته" };
const STATUS_CLASS: Record<string, string> = {
  open: "bg-sand text-pine",
  needs_human: "bg-red-100 text-red-700",
  closed: "bg-slate/15 text-slate",
};

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ConversationsViewer({
  conversations,
  error,
}: {
  conversations: ConvRow[];
  error: string | null;
}) {
  const [rows, setRows] = useState(conversations);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, ConvMessage[]>>({});
  const [filter, setFilter] = useState<"all" | "needs_human" | "open">("all");
  const [pending, start] = useTransition();

  const visible = rows.filter((c) => (filter === "all" ? true : c.status === filter));
  const needsHuman = rows.filter((c) => c.status === "needs_human").length;

  function changeStatus(id: string, status: "open" | "needs_human" | "closed") {
    setRows((r) => r.map((c) => (c.id === id ? { ...c, status } : c)));
    start(async () => {
      await setConversationStatusAction(id, status);
    });
  }

  function makeSummary(id: string) {
    start(async () => {
      const res = await summarizeConversationAction(id);
      if (res.ok && res.summary) {
        setRows((r) => r.map((c) => (c.id === id ? { ...c, summary: res.summary! } : c)));
      }
    });
  }

  function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!detail[id]) {
      start(async () => {
        const res = await getConversationDetailAction(id);
        if (res.ok && res.messages) setDetail((d) => ({ ...d, [id]: res.messages! }));
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">گفتگوها</h1>
        <p className="mt-1 text-caption text-slate">
          مجموعاً {toFa(rows.length)} گفتگوی اخیر. روی هر کدام بزنید تا پیام‌ها و منابع بازیابی‌شده را ببینید.
          {needsHuman > 0 && (
            <span className="ms-2 rounded-full bg-red-100 px-2.5 py-0.5 text-[0.75rem] text-red-700">
              {toFa(needsHuman)} گفتگو منتظر پاسخ انسانی است
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["all", "همه"],
          ["needs_human", "نیازمند انسان"],
          ["open", "باز"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "rounded-btn bg-pine px-4 py-2 text-caption font-medium text-bone"
                : "rounded-btn border border-sand bg-white px-4 py-2 text-caption text-slate transition-colors hover:border-pine/30"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">{error}</div>}

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-sand bg-white px-5 py-12 text-center text-slate">هنوز گفتگویی ثبت نشده است.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-card border border-sand bg-white shadow-soft">
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition-colors hover:bg-bone/60"
              >
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-sand px-2.5 py-0.5 text-[0.75rem] text-pine">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] ${STATUS_CLASS[c.status] ?? "bg-sand text-pine"}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    <span className="text-caption text-slate">{fmt(c.last_at)}</span>
                    {c.contact_hint && <span className="text-caption text-brass">{c.contact_hint}</span>}
                  </span>
                  {c.summary && <span className="text-[0.82rem] leading-6 text-slate">{c.summary}</span>}
                  {c.escalation_reason && (
                    <span className="text-[0.82rem] leading-6 text-red-700">دلیل ارجاع: {c.escalation_reason}</span>
                  )}
                </span>
                <span className="text-caption text-slate">{openId === c.id ? "▲" : "▼"}</span>
              </button>

              <div className="flex flex-wrap gap-2 border-t border-sand bg-bone/30 px-5 py-2.5">
                {c.status !== "needs_human" ? (
                  <button
                    type="button"
                    onClick={() => changeStatus(c.id, "needs_human")}
                    className="rounded-btn border border-sand px-3 py-1.5 text-caption text-slate transition-colors hover:text-red-600"
                  >
                    علامت‌زدن «نیازمند انسان»
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => changeStatus(c.id, "closed")}
                    className="rounded-btn bg-pine px-3 py-1.5 text-caption text-bone transition-colors hover:bg-pine-dark"
                  >
                    رسیدگی شد
                  </button>
                )}
                {c.status === "closed" && (
                  <button
                    type="button"
                    onClick={() => changeStatus(c.id, "open")}
                    className="rounded-btn border border-sand px-3 py-1.5 text-caption text-slate transition-colors hover:text-pine"
                  >
                    بازکردن دوباره
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => makeSummary(c.id)}
                  disabled={pending}
                  className="rounded-btn border border-sand px-3 py-1.5 text-caption text-pine transition-colors hover:bg-bone disabled:opacity-50"
                >
                  {c.summary ? "به‌روزرسانی خلاصه" : "ساخت خلاصه"}
                </button>
              </div>

              {openId === c.id && (
                <div className="border-t border-sand bg-bone/40 px-5 py-4">
                  {!detail[c.id] ? (
                    <p className="text-caption text-slate">{pending ? "در حال بارگذاری…" : "—"}</p>
                  ) : detail[c.id].length === 0 ? (
                    <p className="text-caption text-slate">پیامی ثبت نشده است.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail[c.id].map((m) => (
                        <MessageRow key={m.id} m={m} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageRow({ m }: { m: ConvMessage }) {
  const isUser = m.role === "user";
  return (
    <div className={isUser ? "flex justify-start" : "flex justify-end"}>
      <div className="max-w-[90%]">
        <div
          className={
            isUser
              ? "rounded-card rounded-tr-sm bg-pine px-4 py-2.5 text-[0.9rem] leading-7 text-bone"
              : "rounded-card rounded-tl-sm border border-sand bg-white px-4 py-2.5 text-[0.9rem] leading-7 text-ink"
          }
        >
          <p className="whitespace-pre-wrap">{m.content}</p>
        </div>
        {!isUser && (
          <div className="mt-1 px-1 text-[0.7rem] text-slate">
            {m.model_used && <span>{m.model_used}</span>}
            {m.tokens_out != null && <span> · {toFa(m.tokens_out)} توکن خروجی</span>}
          </div>
        )}
        {/* منابع RAG بازیابی‌شده (برای دیباگ) */}
        {!isUser && m.retrieved.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="px-1 text-[0.7rem] font-medium text-brass">منابع بازیابی‌شده:</p>
            {m.retrieved.map((r, i) => (
              <div key={i} className="rounded-btn border border-sand bg-bone px-3 py-2 text-[0.78rem] leading-6 text-slate">
                <b className="text-pine">{r.title}:</b> {r.content}…
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
