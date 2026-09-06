"use client";

import { useEffect, useRef, useState } from "react";
import { useArkanChat, type ChatMsg } from "@/lib/useArkanChat";
import { renderBold } from "./format";
import FeedbackBar from "./FeedbackBar";

const SITE_URL = "https://arkan-website-chatbot.vercel.app";

export default function WidgetChat({
  welcomeMessage,
  primaryColor,
  suggestedQuestions = [],
}: {
  welcomeMessage: string;
  primaryColor: string;
  suggestedQuestions?: string[];
}) {
  const { messages, loading, conversationId, send, stop, reset } = useArkanChat({
    channel: "widget",
    storageKey: "arkan_widget_conv",
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function submit() {
    if (!input.trim() || loading) return;
    send(input);
    setInput("");
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant" && !m.error)?.id;
  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-bone">
      {/* هدر فشرده */}
      <header className="flex items-center gap-2.5 px-4 py-3 text-bone" style={{ backgroundColor: primaryColor }}>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          <SparkIcon />
        </span>
        <div className="leading-tight">
          <p className="font-heading text-[0.95rem] font-bold">دستیار آرکان</p>
          <p className="text-[0.7rem] opacity-80">معمولاً سریع پاسخ می‌دهد</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="mr-auto rounded-btn bg-white/15 px-2.5 py-1 text-[0.7rem] text-bone transition-colors hover:bg-white/25"
          >
            گفتگوی جدید
          </button>
        )}
      </header>

      {/* پیام‌ها */}
      <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
        {/* پیام خوش‌آمد */}
        <Bubble role="assistant">{welcomeMessage}</Bubble>
        {empty && suggestedQuestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pt-1">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-full border border-sand bg-white px-3 py-1.5 text-right text-[0.78rem] leading-5 text-ink transition-colors hover:border-pine/40"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {empty && suggestedQuestions.length === 0 && (
          <p className="px-1 pt-1 text-[0.75rem] text-slate">
            می‌توانید درباره‌ی خدمات، قیمت‌ها، متدولوژی چهار رکن یا فرایند همکاری بپرسید.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <Bubble role={msg.role} error={msg.error} primaryColor={primaryColor}>
              {msg.content || "…"}
            </Bubble>
            {msg.role === "assistant" && !msg.error && msg.id === lastAssistantId && msg.content && !loading && (
              <FeedbackBar conversationId={conversationId} text={msg.content} compact />
            )}
          </div>
        ))}
        {loading && <TypingDots />}
      </div>

      {/* CTA + ورودی */}
      <div className="border-t border-sand bg-bone px-3 pb-3 pt-2">
        <a
          href={`${SITE_URL}/#consultation`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block rounded-btn py-2 text-center text-[0.8rem] font-medium text-bone"
          style={{ backgroundColor: primaryColor }}
        >
          ثبت درخواست مشاوره‌ی رایگان
        </a>
        <div className="flex items-end gap-2 rounded-card border border-slate/30 bg-white p-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="پیام‌تان را بنویسید…"
            className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.9rem] leading-6 text-ink placeholder:text-slate/60 focus:outline-none"
            aria-label="پیام شما"
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-slate text-bone transition-opacity"
              aria-label="توقف پاسخ"
              title="توقف پاسخ"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-bone transition-opacity disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
              aria-label="ارسال"
            >
              <SendIcon />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[0.65rem] text-slate/70">پاسخ‌ها با هوش مصنوعی تولید می‌شوند.</p>
      </div>
    </div>
  );
}

function Bubble({
  role,
  error,
  primaryColor,
  children,
}: {
  role: ChatMsg["role"];
  error?: boolean;
  primaryColor?: string;
  children: string;
}) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div className="flex justify-start">
        <div
          className="max-w-[85%] rounded-card rounded-tr-sm px-3.5 py-2.5 text-[0.9rem] leading-7 text-bone"
          style={{ backgroundColor: primaryColor ?? "#143A32" }}
        >
          <p className="whitespace-pre-wrap">{children}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div
        className={
          error
            ? "max-w-[88%] rounded-card border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.9rem] leading-7 text-red-700"
            : "max-w-[88%] rounded-card rounded-tl-sm border border-sand bg-white px-3.5 py-2.5 text-[0.9rem] leading-7 text-ink shadow-soft"
        }
      >
        <p className="whitespace-pre-wrap">{renderBold(children)}</p>
      </div>
    </div>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-end">
      <div className="rounded-card rounded-tl-sm border border-sand bg-white px-3.5 py-3 shadow-soft">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate/50" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.9L18.7 9l-4.9 1.1L12 15l-1.8-4.9L5.3 9l4.9-1.1z" />
    </svg>
  );
}
