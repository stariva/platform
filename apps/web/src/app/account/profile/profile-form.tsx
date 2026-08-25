"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth/client";

interface ProfileFormProps {
  initialName: string;
  email: string;
  emailVerified: boolean;
}

export function ProfileForm({
  initialName,
  email,
  emailVerified,
}: ProfileFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const { error } = await authClient.updateUser({ name });
    setSavingName(false);
    if (error) {
      toast.error(error.message || "Не удалось сохранить имя");
      return;
    }
    toast.success("Имя обновлено");
    router.refresh();
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;
    setSavingEmail(true);
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: "/account/profile",
    });
    setSavingEmail(false);
    if (error) {
      toast.error(error.message || "Не удалось изменить email");
      return;
    }
    toast.success(
      "Письмо для подтверждения отправлено на текущий и новый адрес",
    );
    setNewEmail("");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Новый пароль должен быть не короче 8 символов");
      return;
    }
    setSavingPassword(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message || "Не удалось сменить пароль");
      return;
    }
    toast.success("Пароль обновлён");
    setCurrentPassword("");
    setNewPassword("");
  }

  const card = "bg-white border border-espresso/10 rounded-2xl p-6";

  return (
    <div className="space-y-5 max-w-xl">
      {/* Имя */}
      <form onSubmit={saveName} className={card}>
        <h2 className="font-serif text-xl text-espresso mb-4">Имя</h2>
        <div className="space-y-1.5 mb-4">
          <Label htmlFor="name">Как к вам обращаться</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={savingName || name === initialName}
          className="bg-espresso text-parchment hover:bg-espresso/90"
        >
          {savingName ? "Сохраняем…" : "Сохранить"}
        </Button>
      </form>

      {/* Email */}
      <form onSubmit={changeEmail} className={card}>
        <h2 className="font-serif text-xl text-espresso mb-1">Email</h2>
        <p className="text-taupe text-sm mb-4">
          Текущий: <span className="text-espresso">{email}</span>{" "}
          {emailVerified ? (
            <span className="text-sage-dark text-xs">· подтверждён</span>
          ) : (
            <span className="text-terracotta text-xs">· не подтверждён</span>
          )}
        </p>
        <div className="space-y-1.5 mb-4">
          <Label htmlFor="newEmail">Новый email</Label>
          <Input
            id="newEmail"
            type="email"
            placeholder="new@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={savingEmail || !newEmail}
          className="bg-espresso text-parchment hover:bg-espresso/90"
        >
          {savingEmail ? "Отправляем…" : "Изменить email"}
        </Button>
      </form>

      {/* Пароль */}
      <form onSubmit={changePassword} className={card}>
        <h2 className="font-serif text-xl text-espresso mb-4">Смена пароля</h2>
        <div className="space-y-1.5 mb-3">
          <Label htmlFor="currentPassword">Текущий пароль</Label>
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5 mb-4">
          <Label htmlFor="newPassword">Новый пароль</Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button
          type="submit"
          disabled={savingPassword}
          className="bg-espresso text-parchment hover:bg-espresso/90"
        >
          {savingPassword ? "Сохраняем…" : "Сменить пароль"}
        </Button>
      </form>
    </div>
  );
}
