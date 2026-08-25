"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Клиент better-auth для использования в браузере.
 *
 * baseURL не указываем — клиент работает с тем же origin, что и приложение.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
