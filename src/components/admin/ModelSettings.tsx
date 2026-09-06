"use client";

import { useState, useTransition } from "react";
import type { ModelConfig, EmbeddingConfig } from "@/lib/rag/config";
import { saveModelConfigAction, saveEmbeddingConfigAction } from "@/app/admin/chatbot-actions";

const MODEL_GROUPS: { provider: string; models: { slug: string; label: string }[] }[] = [
  { provider: "Anthropic (Claude)", models: [{ slug: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" }] },
  {
    provider: "Google (Gemini)",
    models: [
      { slug: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { slug: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
      { slug: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  {
    provider: "OpenAI",
    models: [
      { slug: "openai/gpt-5-mini", label: "GPT-5 Mini" },
      { slug: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
      { slug: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
  { provider: "Qwen", models: [{ slug: "qwen/qwen3-30b-a3b-instruct-2507", label: "Qwen3 30B" }] },
];

const labelCls = "mb-1.5 block text-caption font-medium text-ink";
const inputCls =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink focus:border-brass focus:outline-none";
const saveCls =
  "inline-flex min-h-[44px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60";

/** معادل انگلیسی اصطلاح، کنار عنوان فارسی — همیشه چپ‌به‌راست نمایش داده می‌شود. */
function En({ children }: { children: string }) {
  return (
    <span dir="ltr" className="ms-1 font-mono text-[0.78rem] font-normal text-slate">
      ({children})
    </span>
  );
}

/** توضیح کوتاه زیر هر فیلد: این گزینه دقیقاً چه می‌کند. */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[0.8rem] leading-6 text-slate">{children}</p>;
}

const CHANNEL_LABELS: Record<string, string> = {
  web: "صفحه‌ی چت",
  widget: "ویجت سایت",
  telegram: "تلگرام",
};

export default function ModelSettings({
  models,
  embedding,
}: {
  models: ModelConfig[];
  embedding: EmbeddingConfig;
}) {
  const [channel, setChannel] = useState(models[0]?.channel ?? "web");
  const current = models.find((m) => m.channel === channel) ?? models[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">مدل‌ها و بازیابی</h1>
        <p className="mt-1 text-caption text-slate">همه‌ی مدل‌های تولید پاسخ از طریق OpenRouter فراخوانی می‌شوند؛ تعویض مدل فقط تغییر یک گزینه است.</p>
      </div>

      {/* هر کانال پیکربندی مستقل دارد: ویجت می‌تواند مدل ارزان‌تر و پاسخ کوتاه‌تر داشته باشد. */}
      <div className="flex flex-wrap gap-2">
        {models.map((m) => (
          <button
            key={m.channel}
            type="button"
            onClick={() => setChannel(m.channel)}
            className={
              m.channel === channel
                ? "rounded-btn bg-pine px-4 py-2 text-caption font-medium text-bone"
                : "rounded-btn border border-sand bg-white px-4 py-2 text-caption text-slate transition-colors hover:border-pine/30"
            }
          >
            {CHANNEL_LABELS[m.channel] ?? m.channel}
          </button>
        ))}
      </div>

      {current && <ModelForm key={current.channel} model={current} />}
      <EmbeddingForm embedding={embedding} />
    </div>
  );
}

function ModelForm({ model }: { model: ModelConfig }) {
  const [activeModel, setActiveModel] = useState(model.active_model);
  const [fallback, setFallback] = useState(model.fallback_model ?? "");
  const [temperature, setTemperature] = useState(model.temperature);
  const [maxTokens, setMaxTokens] = useState(model.max_tokens);
  const [topP, setTopP] = useState(model.top_p);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // اگر مدل فعلی در فهرست نبود، آن را اضافه کن
  const known = MODEL_GROUPS.flatMap((g) => g.models.map((m) => m.slug));
  const extra = known.includes(activeModel) ? [] : [activeModel];

  function save() {
    start(async () => {
      const res = await saveModelConfigAction({
        channel: model.channel,
        active_model: activeModel,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        fallback_model: fallback || null,
      });
      setMsg({ ok: res.ok, text: res.message ?? "" });
    });
  }

  return (
    <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
      <h2 className="mb-1 font-heading text-body font-semibold text-pine">
        مدل تولید پاسخ<En>Generation Model</En>
      </h2>
      <p className="mb-4 text-[0.85rem] leading-7 text-slate">
        مدلی که متن پاسخ چت‌بات را می‌نویسد و پارامترهای نمونه‌برداری آن. این تنظیمات فقط روی کانال <b>{CHANNEL_LABELS[model.channel] ?? model.channel}</b> اثر می‌گذارد؛ کانال‌های دیگر پیکربندی مستقل دارند.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>
            مدل فعال<En>Active Model</En>
          </label>
          <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)} className={`${inputCls} cursor-pointer`}>
            {extra.map((s) => (
              <option key={s} value={s}>{s} (فعلی)</option>
            ))}
            {MODEL_GROUPS.map((g) => (
              <optgroup key={g.provider} label={g.provider}>
                {g.models.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.label} — {m.slug}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <Hint>
            مدل زبانی‌ای که هر پیام کاربر را همراه با منابع بازیابی‌شده می‌گیرد و پاسخ را تولید می‌کند. مدل‌های سبک‌تر (Flash / Mini / Nano) سریع‌تر و ارزان‌ترند، مدل‌های بزرگ‌تر دقیق‌تر.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            مدل جایگزین<En>Fallback Model</En>
          </label>
          <select value={fallback} onChange={(e) => setFallback(e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="">بدون</option>
            {MODEL_GROUPS.map((g) => (
              <optgroup key={g.provider} label={g.provider}>
                {g.models.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <Hint>
            اگر مدل فعال خطا بدهد یا در دسترس نباشد، همان درخواست با این مدل دوباره فرستاده می‌شود. «بدون» یعنی در صورت خطا پاسخی تولید نمی‌شود.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            <span dir="ltr" className="font-mono">Temperature</span>
            <span className="ms-1 font-normal text-slate">— میزان خلاقیت / تصادفی‌بودن پاسخ: {temperature}</span>
          </label>
          <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-pine" />
          <Hint>
            کنترل می‌کند مدل هنگام انتخاب کلمه‌ی بعدی چقدر ریسک کند. نزدیک <b>۰</b> = پاسخ‌های قطعی، تکرارپذیر و نزدیک به متن منابع (مناسب چت‌بات پشتیبانی).
            نزدیک <b>۱</b> = پاسخ‌های متنوع‌تر و خلاقانه‌تر ولی با احتمال بیشترِ انحراف از منابع. پیشنهاد برای این چت‌بات: ۰٫۲ تا ۰٫۴.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            حداکثر توکن پاسخ<En>Max Tokens</En>
          </label>
          <input type="number" min={100} max={4000} step={50} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className={inputCls} />
          <Hint>
            سقف طول پاسخ مدل بر حسب توکن (هر توکن تقریباً ۳٫۵ کاراکتر فارسی). اگر این عدد کم باشد پاسخ‌ها <b>وسط جمله قطع می‌شوند</b> — چون توکن‌های استدلال داخلی مدل هم از همین بودجه خرج می‌شود.
            مقدار امن: <b>۲۰۰۰</b> یا بیشتر.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            <span dir="ltr" className="font-mono">top_p</span>
            <span className="ms-1 font-normal text-slate">— نمونه‌برداری هسته‌ای (Nucleus Sampling): {topP}</span>
          </label>
          <input type="range" min={0.1} max={1} step={0.05} value={topP} onChange={(e) => setTopP(Number(e.target.value))} className="w-full accent-pine" />
          <Hint>
            روش دیگری برای محدودکردن تنوع پاسخ: مدل فقط از محتمل‌ترین کلمه‌هایی انتخاب می‌کند که مجموع احتمالشان به این نسبت برسد.
            <span dir="ltr" className="font-mono"> ۰٫۹ </span> یعنی دنباله‌ی کم‌احتمال کلمات کنار گذاشته می‌شود. معمولاً یا این را تنظیم می‌کنند یا
            <span dir="ltr" className="font-mono"> Temperature </span> را، نه هر دو را هم‌زمان. مقدار <span dir="ltr" className="font-mono">۱</span> یعنی بدون محدودیت.
          </Hint>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className={saveCls}>
          {pending ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات مدل"}
        </button>
        {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}

function EmbeddingForm({ embedding }: { embedding: EmbeddingConfig }) {
  const [chunkSize, setChunkSize] = useState(embedding.chunk_size);
  const [overlap, setOverlap] = useState(embedding.chunk_overlap);
  const [topK, setTopK] = useState(embedding.top_k);
  const [threshold, setThreshold] = useState(embedding.similarity_threshold);
  const [rerankerEnabled, setRerankerEnabled] = useState(embedding.reranker_enabled);
  const [rerankerModel, setRerankerModel] = useState(embedding.reranker_model ?? "rerank-multilingual-v3.0");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    start(async () => {
      const res = await saveEmbeddingConfigAction({
        chunk_size: chunkSize,
        chunk_overlap: overlap,
        top_k: topK,
        similarity_threshold: threshold,
        reranker_enabled: rerankerEnabled,
        reranker_model: rerankerEnabled ? rerankerModel : null,
      });
      setMsg({ ok: res.ok, text: res.message ?? "" });
    });
  }

  return (
    <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
      <h2 className="mb-1 font-heading text-body font-semibold text-pine">
        بُردارسازی و بازیابی
        <En>Embedding &amp; Retrieval</En>
      </h2>
      <p className="mb-4 text-[0.85rem] leading-7 text-slate">
        این بخش تعیین می‌کند اسناد پایگاه دانش چطور به قطعه‌های کوچک شکسته و به بردار عددی تبدیل شوند، و هنگام هر پرسش چند قطعه‌ی مرتبط به مدل داده شود.
      </p>
      <div className="mb-4 rounded-btn bg-sand/60 px-4 py-3 text-[0.85rem] leading-7 text-slate">
        مدل <span dir="ltr" className="font-mono">embedding</span> فعلی: <b className="text-pine">{embedding.provider} / {embedding.model}</b> ({embedding.dimensions} بُعد).
        تغییر مدل <span dir="ltr" className="font-mono">embedding</span> یا ابعاد، نیاز به <b>بازسازی کامل ایندکس</b> دارد و در نسخه‌ی بعدی پنل فعال می‌شود.
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            اندازه‌ی قطعه — توکن<En>Chunk Size</En>
          </label>
          <input type="number" min={100} max={1500} step={50} value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} className={inputCls} />
          <Hint>
            هر سند هنگام ایندکس‌شدن به قطعه‌هایی با این طول بریده می‌شود. قطعه‌ی کوچک = بازیابی دقیق‌تر ولی بریده‌بریده؛ قطعه‌ی بزرگ = زمینه‌ی کامل‌تر ولی نویز بیشتر و هزینه‌ی توکن بالاتر. پیش‌فرض ۵۰۰.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            هم‌پوشانی — توکن<En>Chunk Overlap</En>
          </label>
          <input type="number" min={0} max={300} step={10} value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} className={inputCls} />
          <Hint>
            چند توکن از انتهای هر قطعه در ابتدای قطعه‌ی بعدی تکرار شود. این تکرار عمدی است تا جمله‌ای که درست روی مرز دو قطعه افتاده، معنایش را از دست ندهد. معمولاً ۱۰٪ تا ۲۰٪ اندازه‌ی قطعه.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            <span dir="ltr" className="font-mono">top_k</span>
            <span className="ms-1 font-normal text-slate">— تعداد منبع بازیابی‌شده</span>
          </label>
          <input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className={inputCls} />
          <Hint>
            برای هر پرسش، چند قطعه‌ی نزدیک‌ترین به آن از پایگاه دانش بیرون کشیده و به مدل داده شود. عدد کم = پاسخ متمرکز ولی احتمال جاافتادن اطلاعات؛ عدد زیاد = پوشش بیشتر ولی پرامپت طولانی‌تر و گران‌تر. پیش‌فرض ۵.
          </Hint>
        </div>
        <div>
          <label className={labelCls}>
            آستانه‌ی شباهت<En>Similarity Threshold</En>
            <span className="ms-1 font-normal text-slate">: {threshold}</span>
          </label>
          <input type="range" min={0} max={0.9} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-pine" />
          <Hint>
            حداقل نمره‌ی شباهت (کسینوسی، بین ۰ و ۱) که یک قطعه باید داشته باشد تا اصلاً به مدل داده شود. بالا بردنش جلوی منابع بی‌ربط را می‌گیرد ولی ممکن است چت‌بات بگوید «اطلاعاتی ندارم»؛ پایین آوردنش منابع نویزی وارد پاسخ می‌کند. پیش‌فرض ۰٫۳.
          </Hint>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={rerankerEnabled}
              onChange={(e) => setRerankerEnabled(e.target.checked)}
              className="h-5 w-5 accent-pine"
            />
            <span className="text-caption font-medium text-ink">
              بازچینش نتایج<En>Reranker</En>
            </span>
          </label>
          <Hint>
            جست‌وجوی برداری «شبیه‌ترین» قطعه‌ها را می‌آورد، نه لزوماً «مرتبط‌ترین». با فعال‌بودن این گزینه، سه برابر
            <span dir="ltr" className="font-mono"> top_k </span>
            قطعه بازیابی می‌شود و یک مدل مخصوص، آن‌ها را بر اساس ارتباط واقعی با سؤال دوباره مرتب می‌کند؛ فقط بهترین‌ها به مدل پاسخ‌دهنده می‌رسند.
            دقت را محسوس بالا می‌برد و به‌ازای هر پرسش یک فراخوانی ارزان اضافه می‌کند. نیازمند <span dir="ltr" className="font-mono">COHERE_API_KEY</span>.
          </Hint>
          {rerankerEnabled && (
            <input
              value={rerankerModel}
              onChange={(e) => setRerankerModel(e.target.value)}
              dir="ltr"
              className={`${inputCls} mt-2 font-mono text-[0.85rem]`}
              placeholder="rerank-multilingual-v3.0"
            />
          )}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className={saveCls}>
          {pending ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات بازیابی"}
        </button>
        {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
