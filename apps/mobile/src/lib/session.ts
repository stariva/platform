import { Preferences } from "@capacitor/preferences";
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

/**
 * Последний вошедший пользователь: без сети при запуске сервер его не назовёт,
 * а по его id лежит кэш купленных курсов.
 */
const SESSION_USER_KEY = "stariva.session-user";

async function rememberUser(user: SessionUser | null): Promise<void> {
  if (!user) return;
  await Preferences.set({
    key: SESSION_USER_KEY,
    value: JSON.stringify(user),
  }).catch(() => {});
}

async function lastUser(): Promise<SessionUser | null> {
  try {
    const { value } = await Preferences.get({ key: SESSION_USER_KEY });
    const user = value ? (JSON.parse(value) as Partial<SessionUser>) : null;
    if (
      typeof user?.id === "string" &&
      typeof user.email === "string" &&
      typeof user.name === "string"
    ) {
      return { id: user.id, email: user.email, name: user.name };
    }
  } catch {}
  return null;
}

async function forgetUser(): Promise<void> {
  await Preferences.remove({ key: SESSION_USER_KEY }).catch(() => {});
}

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
    await rememberUser(check.user);
  } else if (check.status === "signed-out") {
    await forgetUser();
    setState({ status: "signed-out" });
  } else {
    // Сервера нет — пускаем с тем, что есть: урок и курсы из кеша ещё можно смотреть
    setState(
      (await tokens.get())
        ? { status: "signed-in", user: await lastUser() }
        : { status: "signed-out" },
    );
  }
}

/** После успешного входа по коду. */
export function signedIn(user: SessionUser | null) {
  setState({ status: "signed-in", user });
  void rememberUser(user);
}

/** Сервер ответил «нужно войти»: токен недействителен — стираем его и показываем вход. */
export async function expireSession(): Promise<void> {
  await tokens.clear();
  await forgetUser();
  setState({ status: "signed-out" });
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
  await forgetUser();
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
