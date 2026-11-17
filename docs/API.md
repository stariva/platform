# Мобильный API Stariva

## Уже есть

Мобильный клиент использует типизированный oRPC-контракт `packages/web-api/src/contract/account.ts`: `account.myCourses`, `lessonDetails`, `lessonVideo`, `saveLessonProgress`, `saveLessonChecklist`, `materialUrl`, `saveWorkshopReview`. Авторизация — bearer-токен через существующий email OTP.

`myCourses` возвращает купленные онлайн-курсы, прогресс, продолжение урока и демо. В ответе нет расписания очных занятий и идентификатора первого урока каждого курса. Поэтому кабинет показывает реальные онлайн-курсы в «Записи и материалы», а разделы очных записей — пустыми.

## Нужно согласовать для очных мастер-классов

Все новые методы должны требовать авторизацию и возвращать только данные владельца записи. Предлагаемый минимальный контракт:

| Метод | Назначение | Нужные поля |
| --- | --- | --- |
| `catalog.list` / `catalog.details` | Публичный мобильный каталог | `id`, `slug`, `title`, `description`, `photos`, `priceRub`, `category`, `level`, `host`, `location`, `program`, `availableSessions`, `reviews` |
| `account.bookings` | Списки записей | `id`, `workshopId`, `sessionId`, `startsAt`, `endsAt`, `timezone`, `status`, `seats`, `paymentStatus`, `cover`, `address`, `onlineUrl` |
| `account.bookingDetails` | Детали и билет | поля записи, `ticketQrPayload`, `checkInCode`, `whatToBring`, `organizerContact`, `cancellationPolicy`, `materials`, `files` |
| `account.createBooking` | Запись | `sessionId`, `seats`, итоговая цена, серверный идентификатор оплаты |
| `account.cancelBooking` / `account.rescheduleBooking` | Управление записью | `bookingId`, причины/новый `sessionId`, итоговый статус и правила возврата |
| `account.bookingReview` | Отзыв о посещении | `bookingId`, `rating`, `text`, статус модерации |
| `account.notificationPreferences` | Напоминания | согласие на уведомления, напоминание за 24 и за 2 часа, часовой пояс |

Для онлайн-курсов полезно расширить `myCourses.courses[]` полями `firstLessonId`, `materialsCount` и `reviewStatus`. Это позволит открыть любой курс в приложении без перехода на сайт.

До реализации методов каталог в мобильном приложении — обозначенная визуальная подборка; цена и оформление покупки открываются на действующем сайте. Приложение не создаёт локальные «бронирования», которые отсутствуют на сервере.

Для проверки в dev-режиме доступен `?demo-bookings=1`: типизированный мок показывает пример предстоящей записи и её детали. Билет явно обозначен недействительным; QR-код не генерируется из фиктивных данных.
