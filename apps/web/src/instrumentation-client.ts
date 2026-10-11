import { z } from "zod";

// CSP запрещает 'unsafe-eval', а Zod 4 при первой валидации пробует
// Function("") и ловит ошибку. Браузер всё равно пишет нарушение script-src
// в консоль. jitless пропускает эту пробу и сразу идёт без JIT-компиляции.
z.config({ jitless: true });
