"use client";

import { paths } from "@stariva/config";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PasswordInput,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@stariva/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "~/auth/client";

const emailPasswordSchema = z.object({
  email: z.email("Некорректный email"),
  password: z.string().min(8, "Пароль должен содержать не менее 8 символов"),
});

const emailOtpSchema = z.object({
  email: z.email("Некорректный email"),
});

type EmailPasswordData = z.infer<typeof emailPasswordSchema>;
type EmailOtpData = z.infer<typeof emailOtpSchema>;

export function UnifiedAuthForm({
  mode = "signin",
  ...props
}: React.ComponentProps<typeof Card> & {
  mode?: "signin" | "signup";
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const passwordForm = useForm<EmailPasswordData>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: { email: "", password: "" },
  });

  const otpForm = useForm<EmailOtpData>({
    resolver: zodResolver(emailOtpSchema),
    defaultValues: { email: "" },
  });

  const onPasswordSubmit = async (data: EmailPasswordData) => {
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          email: data.email,
          password: data.password,
          name: data.email.split("@")[0] ?? "User",
        });
        if (error) {
          if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
            toast.error("Пользователь уже существует. Используйте другой email.");
          } else {
            toast.error(
              error.message || "Не удалось создать аккаунт. Попробуйте ещё раз.",
            );
          }
          return;
        }
        toast.success("Аккаунт создан!");
      } else {
        const { error } = await authClient.signIn.email({
          email: data.email,
          password: data.password,
        });
        if (error) {
          toast.error(error.message || "Неверный email или пароль.");
          return;
        }
        toast.success("Вы вошли в систему");
      }
      router.push(paths.dashboard.root);
    } catch (_error) {
      toast.error(
        mode === "signup"
          ? "Не удалось создать аккаунт. Попробуйте ещё раз."
          : "Неверный email или пароль.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onOtpSubmit = async (data: EmailOtpData) => {
    setLoading(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: data.email,
        type: "sign-in",
      });
      if (error) {
        toast.error(error.message || "Не удалось отправить код. Попробуйте ещё раз.");
        return;
      }
      localStorage.setItem("otp_email", data.email);
      toast.success("Код отправлен! Проверьте почту.");
      router.push(paths.auth.otp);
    } catch (_error) {
      toast.error("Не удалось отправить код. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card {...props}>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {mode === "signup" ? "Создание аккаунта" : "С возвращением"}
        </CardTitle>
        <CardDescription>
          {mode === "signup"
            ? "Выберите способ регистрации"
            : "Выберите способ входа"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Пароль</TabsTrigger>
              <TabsTrigger value="otp">Код на почту</TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-4">
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="m@example.com"
                            autoComplete="email"
                            spellCheck={false}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Пароль</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="••••••••"
                            autoComplete={
                              mode === "signup"
                                ? "new-password"
                                : "current-password"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {mode === "signin" && (
                    <div className="text-right">
                      <Link
                        href={paths.auth.forgotPassword}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Забыли пароль?
                      </Link>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? mode === "signup"
                        ? "Создание аккаунта…"
                        : "Вход…"
                      : mode === "signup"
                        ? "Создать аккаунт"
                        : "Войти"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="otp" className="space-y-4">
              <Form {...otpForm}>
                <form
                  onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={otpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="m@example.com"
                            autoComplete="email"
                            spellCheck={false}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Отправка кода…" : "Отправить код"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm">
            {mode === "signup" ? (
              <>
                Уже есть аккаунт?{" "}
                <Link
                  href={paths.auth.login}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Войти
                </Link>
              </>
            ) : (
              <>
                Нет аккаунта?{" "}
                <Link
                  href={paths.auth.signup}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Зарегистрироваться
                </Link>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
