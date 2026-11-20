"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BoostyActivationForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/boosty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("request_failed");
      setMessage(
        "Если заказ на этот адрес ожидает подтверждения, заявка передана. После проверки оплаты доступ появится в вашем кабинете.",
      );
    } catch {
      setError(true);
      setMessage("Не удалось отправить заявку. Попробуйте ещё раз позже.");
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
        {busy ? "Отправляем…" : "Подтвердить покупку"}
      </Button>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={
            error ? "text-sm text-destructive" : "text-sm text-espresso"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}
