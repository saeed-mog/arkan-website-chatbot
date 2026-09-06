"use client";

import { useState, useTransition } from "react";
import type { ChatSettings } from "@/lib/rag/config";
import { saveChatSettingsAction } from "@/app/admin/chatbot-actions";

const labelCls = "mb-1.5 block text-caption font-medium text-ink";
const inputCls =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink focus:border-brass focus:outline-none";

const DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[0.8rem] leading-6 text-slate">{children}</p>;
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-sand bg-white p-6 shadow-soft">
      <h2 className="mb-1 font-heading text-body font-semibold text-pine">{title}</h2>
      <p className="mb-4 text-[0.85rem] leading-7 text-slate">{desc}</p>
      {children}
    </section>
  );
}

export default function ChatSettingsForm({ settings }: { settings: ChatSettings }) {
  const [s, setS] = useState<ChatSettings>(settings);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(d: number) {
    const days = s.office_days.includes(d)
      ? s.office_days.filter((x) => x !== d)
      : [...s.office_days, d].sort((a, b) => a - b);
    set("office_days", days);
  }

  function save() {
    start(async () => {
      const res = await saveChatSettingsAction(s);
      setMsg({ ok: res.ok, text: res.message ?? "" });
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">تنظیمات چت‌بات</h1>
        <p className="mt-1 text-caption text-slate">
          رفتار چت‌بات در همه‌ی کانال‌ها: سقف مصرف، تحویل به انسان، ساعات کاری و محافظ‌ها.
        </p>
      </div>

      <Section
        title="سقف مصرف"
        desc="دو شیر اصلی برای کنترل هزینه و جلوگیری از سوءاستفاده. هر دو در سمت سرور اعمال می‌شوند."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>حداکثر پیام در دقیقه (به‌ازای هر IP)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={s.rate_limit_per_minute}
              onChange={(e) => set("rate_limit_per_minute", Number(e.target.value))}
              className={inputCls}
            />
            <Hint>
              شمارش در دیتابیس انجام می‌شود، نه در حافظه‌ی سرور — روی Vercel هر درخواست ممکن است به instance دیگری برسد و شمارنده‌ی درون‌حافظه‌ای عملاً هیچ سقفی اعمال نمی‌کند.
            </Hint>
          </div>
          <div>
            <label className={labelCls}>حداکثر پیام در یک گفتگو</label>
            <input
              type="number"
              min={4}
              max={500}
              value={s.max_messages_per_conv}
              onChange={(e) => set("max_messages_per_conv", Number(e.target.value))}
              className={inputCls}
            />
            <Hint>
              بعد از این تعداد، چت‌بات از کاربر می‌خواهد گفتگوی جدید شروع کند. جلوی نشست‌های بی‌پایان و پرامپت‌های متورم را می‌گیرد.
            </Hint>
          </div>
        </div>
      </Section>

      <Section
        title="تحویل به انسان"
        desc="مهم‌ترین دریچه‌ی اطمینان یک چت‌بات: وقتی مدل نمی‌تواند کمک کند، گفتگو باید به آدم واقعی برسد، نه به بن‌بست."
      >
        <label className="mb-4 flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.handoff_enabled}
            onChange={(e) => set("handoff_enabled", e.target.checked)}
            className="h-5 w-5 accent-pine"
          />
          <span className="text-caption font-medium text-ink">ابزار «ارجاع به انسان» فعال باشد</span>
        </label>
        <div>
          <label className={labelCls}>پیامی که هنگام ارجاع به کاربر گفته می‌شود</label>
          <textarea
            value={s.handoff_message}
            onChange={(e) => set("handoff_message", e.target.value)}
            rows={2}
            className={`${inputCls} resize-y leading-7`}
          />
          <Hint>
            با فعال‌بودن این گزینه، مدل ابزاری در اختیار دارد که گفتگو را با وضعیت «نیازمند انسان» در بخش گفتگوها علامت می‌زند و خلاصه‌اش را می‌سازد.
          </Hint>
        </div>
      </Section>

      <Section
        title="ساعات کاری"
        desc="خارج از این بازه، چت‌بات همچنان پاسخ می‌دهد ولی انتظار کاربر را درست تنظیم می‌کند (ساعت تهران)."
      >
        <label className="mb-4 flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.office_hours_enabled}
            onChange={(e) => set("office_hours_enabled", e.target.checked)}
            className="h-5 w-5 accent-pine"
          />
          <span className="text-caption font-medium text-ink">اعمال ساعات کاری</span>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>از ساعت</label>
            <input
              type="time"
              value={s.office_hours_start}
              onChange={(e) => set("office_hours_start", e.target.value)}
              dir="ltr"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>تا ساعت</label>
            <input
              type="time"
              value={s.office_hours_end}
              onChange={(e) => set("office_hours_end", e.target.value)}
              dir="ltr"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>روزهای کاری</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={
                    s.office_days.includes(i)
                      ? "rounded-btn bg-pine px-3 py-2 text-caption text-bone"
                      : "rounded-btn border border-sand bg-white px-3 py-2 text-caption text-slate hover:border-pine/30"
                  }
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>پیام خارج از ساعت کاری</label>
            <textarea
              value={s.offline_message}
              onChange={(e) => set("offline_message", e.target.value)}
              rows={2}
              className={`${inputCls} resize-y leading-7`}
            />
          </div>
        </div>
      </Section>

      <Section
        title="محافظ‌ها و خلاصه‌سازی"
        desc="لایه‌ی امنیتی و ابزار مرور سریع گفتگوها."
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={s.injection_guard_enabled}
              onChange={(e) => set("injection_guard_enabled", e.target.checked)}
              className="mt-1 h-5 w-5 accent-pine"
            />
            <span>
              <span className="text-caption font-medium text-ink">محافظ تزریق پرامپت</span>
              <Hint>
                تلاش‌های رایج برای بیرون‌کشیدن system prompt یا عوض‌کردن نقش ربات را <b>قبل از فراخوانی مدل</b> رد می‌کند (هم امن‌تر، هم ارزان‌تر) و یک یادآوری ایمنی هم به پرامپت اضافه می‌کند.
              </Hint>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={s.pii_masking_enabled}
              onChange={(e) => set("pii_masking_enabled", e.target.checked)}
              className="mt-1 h-5 w-5 accent-pine"
            />
            <span>
              <span className="text-caption font-medium text-ink">ماسک‌کردن اطلاعات تماس در لاگ‌ها</span>
              <Hint>
                شماره و ایمیل در لاگ سرور و جدول «سؤالات بی‌پاسخ» با نشانه جایگزین می‌شود. متن اصلی گفتگو دست‌نخورده می‌ماند چون ثبت لید به شماره‌ی واقعی نیاز دارد.
              </Hint>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={s.summary_enabled}
              onChange={(e) => set("summary_enabled", e.target.checked)}
              className="mt-1 h-5 w-5 accent-pine"
            />
            <span>
              <span className="text-caption font-medium text-ink">خلاصه‌ی خودکار گفتگو</span>
              <Hint>هر چند پیام یک‌بار، با مدل جایگزین (ارزان‌تر) خلاصه ساخته می‌شود و در لیست گفتگوها می‌نشیند.</Hint>
            </span>
          </label>

          {s.summary_enabled && (
            <div className="max-w-xs">
              <label className={labelCls}>هر چند پیام یک‌بار</label>
              <input
                type="number"
                min={2}
                max={50}
                value={s.summary_every_n_messages}
                onChange={(e) => set("summary_every_n_messages", Number(e.target.value))}
                className={inputCls}
              />
            </div>
          )}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex min-h-[44px] items-center justify-center rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
        >
          {pending ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات"}
        </button>
        {msg && <span className={`text-caption ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
