# Stariva Мастер-классы — мобильное приложение

Vite + React внутри оболочки Capacitor 8 (`ru.stariva.workshops`). Веб-бандл
лежит в приложении и обновляется по воздуху через `@capgo/capacitor-updater`;
решение «что ставить» принимает наш API (`account.latestRelease`, таблица
`app_releases`), облако Capgo не используется.

## Требования

| Для чего | Что нужно                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Android  | JDK **21** (плагины Capacitor 8 собираются под Java 21), Android SDK с платформой 36 (`ANDROID_HOME`) |
| iOS      | macOS, Xcode 26+, iOS 15+ (сборка только на Mac)                                                      |

Проверка сборки без локальных SDK — `.github/workflows/mobile.yml`
(debug-APK и симуляторная сборка iOS на каждый PR).

## Команды

```bash
bun run dev            # веб-версия, API проксируется на :3000
bun run dev:android    # эмулятор (поднимет, если спит) + build + sync + APK + установка и запуск
bun run cap:android    # build + sync + открыть Android Studio
bun run cap:ios        # build + sync + открыть Xcode
bun run cap:sync       # только build + sync обоих платформ
bun test               # версии, решение об обновлении, согласованность нативных конфигов
```

Адрес API в оболочке: `VITE_API_URL=https://stariva.ru` при сборке. Ссылка на
App Store (куда вести iOS, когда оболочка устарела): `VITE_IOS_STORE_URL`.

## Вход в аккаунт

Приложение входит в тот же аккаунт, что и сайт: почта → код из письма
(`LoginScreen`). Регистрации в приложении нет — кабинет создают на stariva.ru,
где берётся согласие на обработку персональных данных.

**Схема — bearer-токен, не cookie.** Бандл открывается как `https://localhost`
(Android) и `capacitor://localhost` (iOS), для сайта это другой origin, и cookie
сессии оттуда не ходят (SameSite=Lax, ITP в iOS, сторонние cookie в Android).
Поэтому:

1. `POST /api/auth/sign-in/email-otp` отвечает заголовком `set-auth-token`
   (плагин `bearer` better-auth в `apps/web/src/lib/auth/server.ts`).
2. Токен лежит в Capacitor Preferences (`src/lib/tokens.ts`) и уходит как
   `Authorization: Bearer …` во все запросы: и в `/api/rpc` (`src/lib/api.ts`),
   и в `/api/auth` (`src/lib/auth-client.ts`). Запросы идут с
   `credentials: "omit"`.
3. Сайт отвечает на CORS только этим двум origin'ам, точным значением, без `*`
   и **без** `Access-Control-Allow-Credentials` (`@stariva/auth/cors`, роуты
   `/api/rpc` и `/api/auth`). Список origin'ов — `MOBILE_APP_ORIGINS`
   в `packages/auth/src/origins.ts`; тест `src/auth-origins.test.ts` сверяет его
   с `capacitor.config.ts`: меняете `androidScheme`/`hostname` — меняйте и список.
4. Если сервер на любой запрос отвечает `UNAUTHORIZED`, токен стирается и
   показывается вход. Нет сети при запуске — токен не трогаем.

Токен — это ключ от аккаунта: хранится в Preferences, а не в Keychain/Keystore
(нативного плагина безопасного хранилища в оболочке нет). Его не видят другие
приложения, но он попадает в резервные копии устройства. Перейти на безопасное
хранилище можно позже, заменив `src/lib/tokens.ts` (новый плагин = новая
оболочка, см. ниже).

## Две версии, не путать

- **Бандл** — `version` в `package.json`. Обновляется по воздуху.
- **Оболочка** — Android `versionName`/`versionCode` в `android/app/build.gradle`,
  iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` в Xcode. Меняется только
  новой сборкой из магазина/APK. Значения на двух платформах должны совпадать
  (проверяет `src/native-config.test.ts`). `versionCode` увеличивайте на каждой
  сборке, которую ставят поверх прежней.

## Выпуск обновления бандла (без магазина)

1. Поднять `version` в `package.json`.
2. `bun run release -- --notes "Что нового"` — соберёт бандл, зальёт zip в
   публичный бакет (`mobile/bundles/<версия>.zip`) и добавит строку в
   `app_releases`. `--dry-run` только проверяет.
3. Приложение при запуске и при возвращении из фона спросит `latestRelease` и
   покажет плашку «Доступна версия…»; по кнопке скачает и перезапустится.
   Если новый бандл не сообщит `notifyAppReady` за 10 с, плагин сам откатится
   на прежний, а эта версия на телефоне больше не предлагается.

## Выпуск новой оболочки (нативные изменения, новый плагин)

1. Поднять `versionName`/`versionCode` (Android) и `MARKETING_VERSION`/
   `CURRENT_PROJECT_VERSION` (iOS), `bun run cap:sync`.
2. Android: собрать подписанный release-APK (`./gradlew assembleRelease` с
   `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`). **Ключ подписи один на всю жизнь приложения** и
   хранится вне git: APK с другим ключом не встанет поверх установленного.
   Без локального SDK то же делает workflow «Mobile release»
   (`.github/workflows/mobile-release.yml`, запуск вручную с `version_code`/
   `version_name`) — keystore лежит в секретах `ANDROID_KEYSTORE_*`, готовый
   APK приходит артефактом и GitHub Release.
3. Поднять `version` бандла и опубликовать **один раз**, уже с готовым APK:
   `bun run release -- --apk <файл> --min-native <новая оболочка> --notes "…"`.
   Версия публикуется однократно, поэтому запускать `release` до появления APK
   нельзя. Старые оболочки получат просьбу скачать новую сборку, а не
   сломанный бандл. Следующие выпуски без `--min-native` наследуют этот минимум
   и прежнюю ссылку на APK.
4. iOS: Archive в Xcode → App Store Connect (TestFlight/релиз); ссылка на
   страницу приложения — `VITE_IOS_STORE_URL` в следующей сборке.

## Перед первой публикацией

- CORS закрытого бакета с видео должен пускать `https://localhost` (Android) и
  `capacitor://localhost` (iOS) — иначе плеер не загрузит уроки:
  `bun --env-file=../../.env src/scripts/set-bucket-cors.ts https://stariva.ru … https://localhost capacitor://localhost`
  (из `packages/storage`; правила заменяются целиком — перечислите все адреса).
- Иконки и сплэш сделаны из `assets/` (`bunx capacitor-assets generate …`).
