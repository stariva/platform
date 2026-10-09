import { HatchetClient } from "@hatchet-dev/typescript-sdk/v1";
// Сначала проверка окружения: без неё клиент упал бы с менее понятной ошибкой
import "./env";

/**
 * Общий клиент Hatchet. Токен берётся из HATCHET_CLIENT_TOKEN автоматически
 * (облако https://cloud.onhatchet.run → Settings → API Tokens или свой движок).
 * @see https://docs.hatchet.run/reference/typescript/client
 */
export const hatchet = HatchetClient.init();
