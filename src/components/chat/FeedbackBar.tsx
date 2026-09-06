"use client";

import { useState } from "react";

/**
 * نوار بازخورد زیر آخرین پاسخ دستیار — مشترک بین صفحه‌ی چت و ویجت.
 * 👎 یک کادر دلیل باز می‌کند؛ بدون «چرا»، بازخورد منفی برای بهبود پرامپت
 * و پایگاه دانش تقریباً بی‌استفاده است.
 */
export default function FeedbackBar({
  conversationId,
  text,
  compact = false,
}: {
  conversationId: string | null;
  text?: string;
  compact?: boolean;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const size = compact ? "text-[0.7rem]" : "text-[0.75rem]";

  async function submit(value: "up" | "down", note?: string) {
    if (!conversationId) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, rating: value, comment: note }),
      });
    } catch {
      /* بی‌صدا — بازخورد نباید تجربه‌ی کاربر را خراب کند */
    }
  }

  function rate(value: "up" | "down") {
    if (rating) return;
    setRating(value);
    if (value === "up") {
      setDone(true);
      void submit("up");
    }
  }

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* اجازه‌ی کلیپ‌بورد داده نشده */
    }
  }

  if (done) {
    return <p className={`mt-1 px-1 ${size} text-slate`}>ممنون از بازخوردتان 🙏</p>;
  }

  if (rating === "down") {
    return (
      <div className="mt-2 space-y-2 px-1">
        <label className={`block ${size} text-slate`}>چه چیزی کم بود؟ (اختیاری)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="مثلاً: پاسخ به سؤال من ربطی نداشت…"
          className="w-full resize-none rounded-btn border border-sand bg-white px-3 py-2 text-[0.85rem] text-ink focus:border-brass focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDone(true);
              void submit("down", comment.trim() || undefined);
            }}
            className="rounded-btn bg-pine px-3 py-1.5 text-[0.78rem] text-bone hover:bg-pine-dark"
          >
            ارسال
          </button>
          <button
            type="button"
            onClick={() => {
              setDone(true);
              void submit("down");
            }}
            className="rounded-btn border border-sand px-3 py-1.5 text-[0.78rem] text-slate hover:bg-bone"
          >
            بی‌خیال
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1.5 px-1">
      <span className={`${size} text-slate`}>مفید بود؟</span>
      <button type="button" onClick={() => rate("up")} className="rounded p-1 text-slate hover:text-pine" aria-label="مفید بود">
        <ThumbIcon up />
      </button>
      <button type="button" onClick={() => rate("down")} className="rounded p-1 text-slate hover:text-pine" aria-label="مفید نبود">
        <ThumbIcon />
      </button>
      {text && (
        <>
          <span className="mx-1 text-slate/40">|</span>
          <button
            type="button"
            onClick={copy}
            className={`rounded px-1.5 py-1 ${size} text-slate hover:text-pine`}
            aria-label="کپی پاسخ"
          >
            {copied ? "کپی شد" : "کپی"}
          </button>
        </>
      )}
    </div>
  );
}

function ThumbIcon({ up = false }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={up ? undefined : { transform: "rotate(180deg)" }}
    >
      <path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 3 1.7V9h4.3a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17 19H7z" />
    </svg>
  );
}
