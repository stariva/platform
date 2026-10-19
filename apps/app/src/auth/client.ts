import { russifyAuthErrorResponse } from "@stariva/auth/errors";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: { onResponse: russifyAuthErrorResponse },
});

export const { signIn, signUp, signOut, useSession } = authClient;
