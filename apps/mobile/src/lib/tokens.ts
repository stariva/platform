import { Preferences } from "@capacitor/preferences";
import { createTokenStore } from "@/lib/token-store";

/**
 * Токен сессии в Capacitor Preferences (на iOS — UserDefaults, на Android —
 * SharedPreferences; в браузере — localStorage). Это не Keychain/Keystore: см.
 * README, раздел «Вход».
 */
export const tokens = createTokenStore({
  async get(key) {
    return (await Preferences.get({ key })).value;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
});
