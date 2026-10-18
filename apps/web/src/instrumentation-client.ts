import { z } from "zod";
import { initPostHog, trackHydrationMismatch } from "@/lib/analytics";
import { watchHydrationMismatch } from "@/lib/hydration-diagnostics";

// PostHog стартует до гидрации, чтобы поймать ранние ошибки. Согласие, хост и
// сама загрузка SDK проверяются внутри: при отказе от cookie он не грузится.
initPostHog();
// Серверный текст снимаем до гидрации, иначе при #418 не понять, что разошлось.
watchHydrationMismatch(trackHydrationMismatch);

// CSP запрещает 'unsafe-eval', а Zod 4 при первой валидации пробует
// Function("") и ловит ошибку. Браузер всё равно пишет нарушение script-src
// в консоль. jitless пропускает эту пробу и сразу идёт без JIT-компиляции.
z.config({ jitless: true });
