"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth/client";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Введите имя"),
});
type NameFormValues = z.infer<typeof nameSchema>;

const emailSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .min(1, "Введите email")
    .email("Некорректный email"),
});
type EmailFormValues = z.infer<typeof emailSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z
    .string()
    .min(8, "Новый пароль должен быть не короче 8 символов"),
});
type PasswordFormValues = z.infer<typeof passwordSchema>;

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

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const nameForm = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: initialName },
  });
  const currentName = nameForm.watch("name");

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  async function saveName(data: NameFormValues) {
    setSavingName(true);
    const { error } = await authClient.updateUser({ name: data.name });
    setSavingName(false);
    if (error) {
      toast.error(error.message || "Не удалось сохранить имя");
      return;
    }
    toast.success("Имя обновлено");
    router.refresh();
  }

  async function changeEmail(data: EmailFormValues) {
    setSavingEmail(true);
    const { error } = await authClient.changeEmail({
      newEmail: data.newEmail,
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
    emailForm.reset({ newEmail: "" });
  }

  async function changePassword(data: PasswordFormValues) {
    setSavingPassword(true);
    const { error } = await authClient.changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      revokeOtherSessions: true,
    });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message || "Не удалось сменить пароль");
      return;
    }
    toast.success("Пароль обновлён");
    passwordForm.reset({ currentPassword: "", newPassword: "" });
  }

  const card = "bg-white border border-espresso/10 rounded-2xl p-6";

  return (
    <div className="space-y-5 max-w-xl">
      {/* Имя */}
      <Form {...nameForm}>
        <form onSubmit={nameForm.handleSubmit(saveName)} className={card}>
          <h2 className="font-serif text-xl text-espresso mb-4">Имя</h2>
          <FormField
            control={nameForm.control}
            name="name"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel>Как к вам обращаться</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={savingName || currentName === initialName}
            className="bg-espresso text-parchment hover:bg-espresso/90"
          >
            {savingName ? "Сохраняем…" : "Сохранить"}
          </Button>
        </form>
      </Form>

      {/* Email */}
      <Form {...emailForm}>
        <form onSubmit={emailForm.handleSubmit(changeEmail)} className={card}>
          <h2 className="font-serif text-xl text-espresso mb-1">Email</h2>
          <p className="text-taupe text-sm mb-4">
            Текущий: <span className="text-espresso">{email}</span>{" "}
            {emailVerified ? (
              <span className="text-sage-dark text-xs">· подтверждён</span>
            ) : (
              <span className="text-terracotta text-xs">· не подтверждён</span>
            )}
          </p>
          <FormField
            control={emailForm.control}
            name="newEmail"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel>Новый email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="new@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={savingEmail}
            className="bg-espresso text-parchment hover:bg-espresso/90"
          >
            {savingEmail ? "Отправляем…" : "Изменить email"}
          </Button>
        </form>
      </Form>

      {/* Пароль */}
      <Form {...passwordForm}>
        <form
          onSubmit={passwordForm.handleSubmit(changePassword)}
          className={card}
        >
          <h2 className="font-serif text-xl text-espresso mb-4">
            Смена пароля
          </h2>
          <FormField
            control={passwordForm.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem className="mb-3">
                <FormLabel>Текущий пароль</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={passwordForm.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel>Новый пароль</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Минимум 8 символов"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={savingPassword}
            className="bg-espresso text-parchment hover:bg-espresso/90"
          >
            {savingPassword ? "Сохраняем…" : "Сменить пароль"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
