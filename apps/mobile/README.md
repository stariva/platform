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
bun run cap:android    # build + sync + открыть Android Studio
bun run cap:ios        # build + sync + открыть Xcode
bun run cap:sync       # только build + sync обоих платформ
bun test               # версии, решение об обновлении, согласованность нативных конфигов
```

Адрес API в оболочке: `VITE_API_URL=https://stariva.ru` при сборке. Ссылка на
App Store (куда вести iOS, когда оболочка устарела): `VITE_IOS_STORE_URL`.

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
2. Поднять `version` бандла и выпустить его с `--min-native <новая оболочка>`:
   старые оболочки получат просьбу скачать новую сборку, а не сломанный бандл.
3. Android: подписанный release-APK (`./gradlew assembleRelease` с
   `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`), затем `bun run release -- --apk <файл> --min-native …`.
   **Ключ подписи один на всю жизнь приложения** и хранится вне git: APK с
   другим ключом не встанет поверх установленного.
4. iOS: Archive в Xcode → App Store Connect (TestFlight/релиз).

## Перед первой публикацией

- CORS закрытого бакета с видео должен пускать `https://localhost` (Android) и
  `capacitor://localhost` (iOS) — иначе плеер не загрузит уроки:
  `bun --env-file=../../.env src/scripts/set-bucket-cors.ts https://stariva.ru … https://localhost capacitor://localhost`
  (из `packages/storage`; правила заменяются целиком — перечислите все адреса).
- Иконки и сплэш сделаны из `assets/` (`bunx capacitor-assets generate …`).
