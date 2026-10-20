"use client";

import { russifyAuthErrorResponse } from "@stariva/auth/errors";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Клиент better-auth для использования в браузере.
 *
 * baseURL не указываем — клиент работает с тем же origin, что и приложение.
 * Ошибки сервера переводятся на русский (см. russifyAuthErrorResponse).
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
  fetchOptions: { onResponse: russifyAuthErrorResponse },
});

export const { signIn, signUp, signOut, useSession } = authClient;
