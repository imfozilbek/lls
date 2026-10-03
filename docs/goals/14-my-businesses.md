# Цель 14. «Mening bizneslarim»: админка бизнесов и бот без токена

**Статус:** 🔨 в работе (код готов, ждёт проверки в продакшене) · **ROADMAP:** M5 · **Зависит от:** 01

## Зачем
Владелец не должен копировать токен из @BotFather: это самый трудный шаг подключения для
человека из района. Он открывает Mini App бота Zumda, нажимает «Bot yaratish», и бот бизнеса
появляется в **его собственном** аккаунте Telegram, а Zumda управляет им сама. Из того же места
владелец ведёт все свои бизнесы: заказы, каталог, деньги, настройки.

## Основа: Telegram Managed Bots (Bot API 9.6, апрель 2026)
- Боту Zumda включён **Bot Management Mode** в @BotFather: `getMe` → `can_manage_bots: true`
  (проверяет `scripts/check-access.sh`).
- Worker готовит кнопку: `savePreparedKeyboardButton(user_id, button: { request_managed_bot:
  { request_id, suggested_name, suggested_username } })` → `id`.
- Mini App открывает окно Telegram: `WebApp.requestChat(id)` (Telegram 9.6+). Владелец
  подтверждает имя и @username, бот создаётся в его аккаунте.
- Запасной путь для старых приложений Telegram: ссылка
  `https://t.me/newbot/<бот Zumda>/<username>?name=<имя>`.
- Боту Zumda приходит обновление `managed_bot` (`user`: владелец, `bot`: новый бот); Worker
  берёт токен `getManagedBotToken(user_id = id бота)` и сразу шифрует его (AES-GCM).
- `replaceManagedBotToken` выпускает новый токен (в коде есть, пока не вызывается).

## Что сделано
1. **Ядро:** `Business.botSource` (`managed` | `token`), порт `ManagedBotRepository`,
   `ManagedBotChangedUseCase` (новый бот / сменился токен / сменился владелец),
   `ListMyManagedBotsUseCase`, `RegisterShopUseCase` берёт `managedBotId` (только свой и ещё не
   занятый бот). В DTO владельца: `managedBot: boolean`.
2. **Worker:**
   - миграция `0006_managed_bots.sql` (только добавления): `businesses.bot_source`, таблица
     `managed_bots`;
   - `/tg/platform` принимает `managed_bot`: токен → шифрование → «Bot yaratildi» владельцу с
     кнопкой «Davom etish»; у работающего бизнеса новый токен сразу подключается заново (webhook,
     меню); у ожидающего ждёт одобрения; смена владельца: оповещение админам, бизнес остаётся у
     прежнего владельца;
   - `POST /api/platform/managed-bot/prepare` → `{ preparedId, link }` (имя и @username из
     названия бизнеса, латиница, `_bot`, ≤ 32), `GET /api/platform/managed-bots`;
   - `POST /api/platform/shops`: `botToken` **или** `managedBotId` (ровно одно);
   - доступ из бота Zumda: `X-Shop` + `X-Via: admin` → initData проверяется токеном бота Zumda;
     роль `owner` только владельцу, остальным 403; витрина (`X-Via: marketplace`) не изменилась;
   - `deploy.sh`: бот Zumda получает `managed_bot`; `check-access.sh` проверяет `can_manage_bots`.
3. **Mini App:** «Mening bizneslarim» (статусы, «Yangi biznes»); мастер: 1 бизнес → 2 бот
   («Bot yaratish», ожидание, «Bot yaratildi», «Havola orqali yaratish», «Menda bot bor») →
   3 доставка и карта; бизнес из списка открывает полный раздел владельца прямо в боте Zumda.
   Только узбекский, светлая тема, JS 86,9 КБ gzip.
4. **Тесты:** Worker 19 новых (создание, токен, владелец, чужой бот, ровно одно из двух, доступ
   admin: свой 200, чужой 403, подпись бота бизнеса 401, старый initData 401, витрина как
   покупатель); e2e `managed-bots.spec.ts` (создание через окно и через ссылку, одобрение, «Mening
   bizneslarim», чужой 403, новый токен, новый владелец); путь с токеном в
   `onboarding-admin.spec.ts`.

## Проверить на практике (с владельцем, в продакшене)
| Вопрос | Ответ |
|--------|-------|
| Что приходит, когда владелец меняет токен бота в @BotFather? | ⏳ ждёт проверки |
| Что приходит, когда бот передают другому владельцу? | ⏳ ждёт проверки |
| Можно ли отключить управление ботом Zumda? Что тогда приходит? | ⏳ ждёт проверки |
| Сколько ботов можно создать так (лимит)? | ⏳ ждёт проверки |

Ожидание по документации: смена токена и владельца приходят новым `managed_bot`; код это
обрабатывает. Ответы записать сюда после проверки.

## Definition of done
- [x] `can_manage_bots` проверяет `scripts/check-access.sh` (3 октября 2026: OK).
- [ ] В продакшене новый владелец создаёт бот из Mini App Zumda, не видя токена; одобрение
      подключает бот.
- [x] «Mening bizneslarim» управляет любым своим бизнесом; чужой: 403 (Worker и e2e).
- [x] Новый токен подхватывается сам; смена владельца оповещает админов (Worker и e2e).
- [x] Путь с токеном работает (e2e).
- [ ] Ответы «проверить на практике» записаны.
- [x] Unit, Worker и e2e тесты зелёные; гейты; [ ] CI и деплой прошли.
- [x] Документы обновлены; [ ] цель и индекс отмечены ✅.

## Чего не делаем
- Веб-админку вне Telegram.
- Перевод старых ботов (из @BotFather) под управление Zumda.
