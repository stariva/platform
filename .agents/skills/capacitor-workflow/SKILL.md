---
name: capacitor-workflow
description: Use when initializing the project, adding native platforms or Capacitor plugins, syncing, building Android, configuring icons/splash/permissions, or preparing store releases for the Stariva app.
---

# Capacitor workflow (Windows-хост)

## Инициализация (один раз)
```
npm create vite@latest . -- --template react-ts
npm i @capacitor/core @capacitor/cli
npx cap init "Stariva" "ru.stariva.app" --web-dir=dist
npm i @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios        # на Windows папка создаётся, но собирать iOS нельзя
```
Перед `cap add` убедись, что `npm run build` создаёт `dist/`.

## Ежедневный цикл
- Разработка в браузере: `npm run dev`, мобильный вьюпорт.
- Нативная проверка Android: `npm run build && npx cap sync android && npx cap run android` (эмулятор или устройство по USB).
- Live reload на устройстве: `npx cap run android -l --external`.

## Плагины и разрешения
- Ставь только нужные плагины; после каждого — `npx cap sync`.
- Push-уведомления: потребуется Firebase (`google-services.json` в `android/app/`) — не коммить ключи.
- Все нативные вызовы оборачивай в `src/lib/native.ts` с проверкой `Capacitor.isNativePlatform()`, чтобы приложение работало и в браузере.

## Иконки и splash
- Исходники: `resources/icon.png` (1024×1024), `resources/splash.png` (2732×2732, важный контент в центре).
- Генерация: `npm i -D @capacitor/assets && npx capacitor-assets generate`.

## Безопасность сети
- Только HTTPS. Не включай `cleartext` в проде. Для dev-API допускай исключение только в debug-конфиге.

## Релиз
- Android: подписанный AAB через Android Studio или Gradle; keystore хранить вне репозитория.
- iOS: на Windows не собирается — нужен облачный macOS (Codemagic или GitHub Actions macOS runner) и аккаунт Apple Developer.
- Для РФ-аудитории рассмотри также RuStore (APK/AAB).
- Перед релизом: проверь `versionName/versionCode`, политику конфиденциальности (ссылка на сайт), список разрешений.
