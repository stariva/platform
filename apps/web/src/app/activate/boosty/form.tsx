"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "success" | "info" | "error";

interface ActivationResponse {
  activated?: number;
  alreadyActive?: boolean;
  queued?: boolean;
  error?: string;
}

export function BoostyActivationForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setStatus("idle");
    const address = email.trim().toLowerCase();
    try {
      const response = await fetch("/api/boosty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as ActivationResponse | null;
      if (!response.ok) {
        setStatus("error");
        setMessage(
          data?.error ?? "Не удалось активировать доступ. Попробуйте ещё раз.",
        );
        return;
      }
      if (data?.queued) {
        setStatus("info");
        setMessage(
          "Не удалось открыть доступ автоматически. Заявка передана — мы проверим оплату и напишем на почту.",
        );
        return;
      }
      if (data?.activated) {
        setStatus("success");
        setMessage(
          `Готово! Доступ открыт. На ${address} отправлено письмо со ссылкой для входа.`,
        );
        return;
      }
      if (data?.alreadyActive) {
        setStatus("info");
        setMessage(
          "Этот email уже активирован. Доступ открыт — войдите по ссылке из письма.",
        );
        return;
      }
      setStatus("info");
      setMessage(
        "Заказ с таким email не найден. Укажите адрес, который вы ввели перед оплатой на Boosty.",
      );
    } catch {
      setStatus("error");
      setMessage("Не удалось активировать доступ. Попробуйте ещё раз позже.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 space-y-4 rounded-2xl border border-espresso/15 bg-sand p-5 sm:p-8"
    >
      <label htmlFor="boosty-email" className="block text-sm font-medium">
        Email для доступа
      </label>
      <Input
        id="boosty-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={busy}
        className="h-12 bg-parchment text-base"
        placeholder="olga@mail.ru"
      />
      <Button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full rounded-xl bg-terracotta text-parchment hover:bg-terracotta-dark"
      >
        {busy ? "Активируем…" : "Активировать доступ"}
      </Button>
      {message && (
        <p
          role={status === "error" ? "alert" : "status"}
          className={
            status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-espresso"
          }
        >
          {message}
        </p>
      )}
      {status === "success" && (
        <a
          href="/account"
          className="inline-block text-sm font-medium text-terracotta underline underline-offset-4 hover:text-terracotta-dark"
        >
          Перейти в кабинет
        </a>
      )}
    </form>
  );
}
