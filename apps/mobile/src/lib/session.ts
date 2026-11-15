import { useSyncExternalStore } from "react";
import { API_URL, api } from "@/lib/api";
import {
  type AuthClient,
  createAuthClient,
  type SessionUser,
} from "@/lib/auth-client";
import { tokens } from "@/lib/tokens";

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  /** `user` пуст, если сервер был недоступен при запуске: токен есть, остальное узнаем позже. */
  | { status: "signed-in"; user: SessionUser | null };

export const authClient: AuthClient = createAuthClient({
  baseUrl: API_URL,
  tokens,
  fetchFormToken: async () => (await api.forms.formToken()).token,
});

let state: SessionState = { status: "loading" };
const listeners = new Set<() => void>();

function setState(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Проверяет сохранённый токен при запуске приложения. */
export async function startSession(): Promise<void> {
  const check = await authClient.checkSession();
  if (check.status === "signed-in") {
    setState({ status: "signed-in", user: check.user });
  } else if (check.status === "signed-out") {
    setState({ status: "signed-out" });
  } else {
    // Сервера нет — пускаем с тем, что есть: урок из кеша ещё можно смотреть
    setState(
      (await tokens.get())
        ? { status: "signed-in", user: null }
        : { status: "signed-out" },
    );
  }
}

/** После успешного входа по коду. */
export function signedIn(user: SessionUser | null) {
  setState({ status: "signed-in", user });
}

/** Сервер ответил «нужно войти»: токен недействителен — стираем его и показываем вход. */
export async function expireSession(): Promise<void> {
  await tokens.clear();
  setState({ status: "signed-out" });
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
  setState({ status: "signed-out" });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state);
}
