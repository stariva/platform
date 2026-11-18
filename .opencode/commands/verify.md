---
description: Проверить изменения (Biome, typecheck, tests)
---

Проверь изменения перед сдачей. Область: $ARGUMENTS (если пусто — весь репозиторий).

1. `git status --short` и `git diff --stat` — пойми, какие пакеты затронуты.
2. `bun run check` — Biome. Ошибки исправляй только в затронутых файлах.
3. `bun run typecheck`. Если весь реп долго — `bunx turbo run typecheck --filter="...[HEAD]"`.
4. Тесты: `bun test` или точечно `bun test <path>` для затронутых пакетов.
5. Если менялся UI — загрузи скилл `ui-qa` и проверь экран через Playwright MCP.

В ответе: что запускал, что упало, что исправил. Не коммить и не пушить без просьбы.
