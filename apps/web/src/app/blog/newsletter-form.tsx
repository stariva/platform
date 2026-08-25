"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reachGoal } from "@/lib/analytics";

interface NewsletterFormProps {
  /** Источник подписки для аналитики и заявки (например, "blog", "footer"). */
  source?: string;
}

export function NewsletterForm({ source = "blog" }: NewsletterFormProps) {
  const fieldId = useId();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Укажите корректный email");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Не удалось оформить подписку");
        return;
      }
      reachGoal("newsletter_subscribe", { source });
      toast.success(
        "Готово! Спасибо за подписку — будем писать только по делу.",
      );
      setEmail("");
    } catch {
      toast.error("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
      onSubmit={handleSubmit}
    >
      <label htmlFor={fieldId} className="sr-only">
        Ваш email
      </label>
      <Input
        id={fieldId}
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Ваш email"
        autoComplete="email"
        disabled={submitting}
        className="flex-1 rounded-full border-espresso/15 bg-parchment text-espresso placeholder:text-taupe/60 focus-visible:border-terracotta"
      />
      <Button
        type="submit"
        disabled={submitting}
        className="label-caps-md px-6 py-3 h-auto rounded-full bg-espresso text-parchment hover:bg-terracotta transition-colors"
      >
        {submitting ? "Отправляем…" : "Подписаться"}
      </Button>
    </form>
  );
}
