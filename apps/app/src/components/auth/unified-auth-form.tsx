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
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const emailOtpSchema = z.object({
  email: z.email("Invalid email address"),
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
            toast.error("User already exists. Use another email.");
          } else {
            toast.error(
              error.message || "Failed to create account. Please try again.",
            );
          }
          return;
        }
        toast.success("Account created successfully!");
      } else {
        const { error } = await authClient.signIn.email({
          email: data.email,
          password: data.password,
        });
        if (error) {
          toast.error(error.message || "Invalid email or password.");
          return;
        }
        toast.success("Signed in successfully!");
      }
      router.push(paths.dashboard.root);
    } catch (_error) {
      toast.error(
        mode === "signup"
          ? "Failed to create account. Please try again."
          : "Invalid email or password.",
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
        toast.error(error.message || "Failed to send code. Please try again.");
        return;
      }
      localStorage.setItem("otp_email", data.email);
      toast.success("Code sent! Check your email.");
      router.push(paths.auth.otp);
    } catch (_error) {
      toast.error("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card {...props}>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {mode === "signup" ? "Create an account" : "Welcome back"}
        </CardTitle>
        <CardDescription>
          {mode === "signup"
            ? "Choose your preferred sign up method"
            : "Choose your preferred sign in method"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="otp">Email code</TabsTrigger>
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
                        <FormLabel>Password</FormLabel>
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
                        Forgot password?
                      </Link>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? mode === "signup"
                        ? "Creating account…"
                        : "Signing in…"
                      : mode === "signup"
                        ? "Create account"
                        : "Sign in"}
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
                    {loading ? "Sending code…" : "Send code"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link
                  href={paths.auth.login}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  href={paths.auth.signup}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
