import { z } from "zod";
import { initPostHog } from "@/lib/analytics";

// PostHog стартует до гидрации, чтобы поймать ранние ошибки. Согласие, хост и
// сама загрузка SDK проверяются внутри: при отказе от cookie он не грузится.
initPostHog();

// CSP запрещает 'unsafe-eval', а Zod 4 при первой валидации пробует
// Function("") и ловит ошибку. Браузер всё равно пишет нарушение script-src
// в консоль. jitless пропускает эту пробу и сразу идёт без JIT-компиляции.
z.config({ jitless: true });
