import posthog from "posthog-js";
import { z } from "zod";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-05-30",
});

// CSP запрещает 'unsafe-eval', а Zod 4 при первой валидации пробует
// Function("") и ловит ошибку. Браузер всё равно пишет нарушение script-src
// в консоль. jitless пропускает эту пробу и сразу идёт без JIT-компиляции.
z.config({ jitless: true });
