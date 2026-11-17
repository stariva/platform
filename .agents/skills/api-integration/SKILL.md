---
name: api-integration
description: Use when connecting the Stariva app to the existing website REST/GraphQL API, defining types, auth, caching, error handling, or writing mocks while the API contract is incomplete.
---

# Интеграция с API сайта

## Принципы
- Контракт — `docs/API.md` (OpenAPI/примеры ответов). Не угадывай поля: если контракта нет, попроси его и работай через мок-слой `src/api/mocks` с тем же интерфейсом, что и реальный клиент.
- Один HTTP-клиент `src/api/client.ts` (fetch-обёртка): базовый URL из `import.meta.env.VITE_API_URL`, таймауты, повтор для идемпотентных запросов, единый формат ошибок.
- Каждый ответ валидируй схемой Zod в `src/api/schemas.ts`; типы выводи через `z.infer`.
- Данные в UI — только через TanStack Query-хуки в `features/*/queries.ts` (ключи запросов централизованы, staleTime осмысленный, optimistic update для избранного).

## Авторизация
- Определи схему из `docs/API.md` (токен, cookie-сессия, OAuth/СМС-код).
- Токены храни в защищённом хранилище (Capacitor Secure Storage плагин), не в localStorage.
- Обработай 401: refresh/выход на экран входа без потери введённых данных.

## Данные мастер-классов (ожидаемые сущности)
Workshop (id, title, description, photos, price, duration, level, tags, host, location), Session (дата/время, свободные места), Booking, User, Review. Уточни реальные поля по API и зафиксируй в `docs/API.md`.

## Ошибки и офлайн
- Различай: нет сети, таймаут, 4xx (показать сообщение), 5xx (retry).
- Кэшируй каталог для офлайн-просмотра (persist query cache), запись и оплата — только онлайн.

## Конфигурация
- `.env.example` с `VITE_API_URL=`; реальный `.env` не коммитится.
- Для dev из браузера учти CORS: используй proxy в `vite.config.ts`.
