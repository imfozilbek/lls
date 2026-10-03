# Цель 14. «Mening bizneslarim»: админка бизнесов и бот без токена

**Статус:** ✅ закрыта решением владельца (3 октября 2026) · **ROADMAP:** M5 · **Зависит от:** 01

## Зачем
Владелец не должен копировать токен из @BotFather: это самый трудный шаг подключения для
человека из района. Он открывает Mini App бота **Zumda | Business**, нажимает «Bot yaratish», и бот бизнеса
появляется в **его собственном** аккаунте Telegram, а Zumda управляет им сама. Из того же места
владелец ведёт все свои бизнесы: заказы, каталог, деньги, настройки.

## Три бота по ролям (решение владельца, 3 октября 2026)
- **Zumda | Shop** (`@zumdashop_bot`): только покупатели: витрина, поиск, заказы.
- **Zumda | Business** (`@zumdashop_business_bot`): владельцы и админы: «Mening bizneslarim» (`?mode=business`), заявки,
  одобрение, команды админов (`/reconnect`, `/market`, `/district`, `/network`; позже, в октябре
  2026, их заменил раздел «Platforma» в Mini App: боты без команд), все сообщения
  владельцам о бизнесе и оповещения админам; он создаёт боты бизнесов и управляет ими.
- **Zumda | Kuryer** (`@zumdashop_kuryer_bot`): курьеры.

Почему сейчас: бот, созданный через Managed Bots, навсегда закреплён за ботом-менеджером.
Менеджером стал Zumda | Business, пока в продакшене не было ни одного такого бота (таблица
`managed_bots` пуста). Вход владельца `X-Via: admin` из PR #30 заменён на `X-Bot: business`;
маршруты `/api/platform/*` принимают только подпись Zumda | Business. Старые карточки одобрения,
отправленные клиентским ботом, ещё работают. Имена ботов ставит деплой (`setMyName`).

## Основа: Telegram Managed Bots (Bot API 9.6, апрель 2026)
- Боту Zumda | Business включается **Bot Management Mode** в @BotFather: `getMe` → `can_manage_bots: true`
  (проверяет `scripts/check-access.sh`).
- Worker готовит кнопку: `savePreparedKeyboardButton(user_id, button: { request_managed_bot:
  { request_id, suggested_name, suggested_username } })` → `id`.
- Mini App открывает окно Telegram: `WebApp.requestChat(id)` (Telegram 9.6+). Владелец
  подтверждает имя и @username, бот создаётся в его аккаунте.
- Запасной путь для старых приложений Telegram: ссылка
  `https://t.me/newbot/zumdashop_business_bot/<username>?name=<имя>`.
- Боту Zumda | Business приходит обновление `managed_bot` (`user`: владелец, `bot`: новый бот); Worker
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
   - `/tg/business` принимает `managed_bot`: токен → шифрование → «Bot yaratildi» владельцу с
     кнопкой «Davom etish»; у работающего бизнеса новый токен сразу подключается заново (webhook,
     меню); у ожидающего ждёт одобрения; смена владельца: оповещение админам, бизнес остаётся у
     прежнего владельца;
   - `POST /api/platform/managed-bot/prepare` → `{ preparedId, link }` (имя и @username из
     названия бизнеса, латиница, `_bot`, ≤ 32), `GET /api/platform/managed-bots`;
   - `POST /api/platform/shops`: `botToken` **или** `managedBotId` (ровно одно);
   - доступ из Zumda | Business: `X-Bot: business` (+ `X-Shop`) → initData проверяется его токеном;
     роль `owner` только владельцу, остальным 403; витрина (`X-Via: marketplace`) не изменилась;
   - `deploy.sh`: Zumda | Business получает `managed_bot`; `check-access.sh` проверяет `can_manage_bots`.
3. **Mini App:** «Mening bizneslarim» (статусы, «Yangi biznes»); мастер: 1 бизнес → 2 бот
   («Bot yaratish», ожидание, «Bot yaratildi», «Havola orqali yaratish», «Menda bot bor») →
   3 доставка и карта; бизнес из списка открывает полный раздел владельца прямо в боте Zumda.
   Только узбекский, светлая тема, JS 86,9 КБ gzip.
4. **Тесты:** Worker 19 новых (создание, токен, владелец, чужой бот, ровно одно из двух, доступ
   admin: свой 200, чужой 403, подпись бота бизнеса 401, старый initData 401, витрина как
   покупатель); e2e `managed-bots.spec.ts` (создание через окно и через ссылку, одобрение, «Mening
   bizneslarim», чужой 403, новый токен, новый владелец); путь с токеном в
   `onboarding-admin.spec.ts`.

## Проверить на практике (продакшен, 3 октября 2026)
| Вопрос | Ответ |
|--------|-------|
| Создаёт ли «Bot yaratish» бота без токена? | **Да.** Владелец создал `@jasur_milliy_taomlar_bot` из Zumda \| Business; в 12:56 UTC пришёл `managed_bot`, Zumda получила токен (`getManagedBotToken`) и сохранила его зашифрованным; владелец токена не видел. |
| Что приходит при смене токена в @BotFather? | Не проверяли (решение владельца: revoke не делаем). Документация не обещает событие, поэтому Zumda **берёт свежий токен у Telegram перед каждым использованием**: при заявке, одобрении, `/reconnect` (fix в этом PR; теперь это «Botni qayta ulash» в «Platforma»). |
| Что приходит при передаче бота другому владельцу? | Не проверяли. Код обрабатывает новый `managed_bot` с другим `user`: оповещение админам, бизнес остаётся у прежнего владельца. |
| Можно ли отключить управление и что тогда? | Не проверяли. Если Telegram перестанет давать токен, одобрение и `/reconnect` не подключат бот, и админ получит предупреждение с `/reconnect` (тест Worker). |
| Лимит ботов | Не упёрлись; данных нет. |

## Definition of done
- [x] Bot Management Mode у бота-менеджера: проверено скриптом для `@zumdashop_bot`; у
      `@zumdashop_business_bot` подтверждено делом (бот создан через него в продакшене).
- [x] В продакшене владелец создаёт бот из Mini App Zumda | Business, не видя токена.
- [x] Заявка и одобрение в продакшене: пересмотр онбординга выпущен (PR #35: заявка из трёх
      шагов, бот работает сразу, одобрение подключает его), `can_manage_bots` подтверждён
      `scripts/check-access.sh`. Ручной проход владелец сделает сам и напишет, если что-то не
      так (решение владельца, 3 октября 2026).
- [x] «Mening bizneslarim» управляет любым своим бизнесом; чужой: 403 (Worker и e2e).
- [x] Новый токен подхватывается сам (теперь и без события); смена владельца оповещает админов.
- [x] Путь с токеном работает (e2e).
- [x] Ответы «проверить на практике» записаны (что проверено и что нет).
- [x] Unit, Worker и e2e тесты зелёные; гейты, CI и деплой прошли (PR #30, #31, #32).
- [x] Документы обновлены; цель и индекс отмечены.

**Статус:** ✅ закрыта решением владельца (3 октября 2026). Пересмотр онбординга выпущен
(PR #35); замечания с ручного прохода в продакшене владелец пришлёт отдельно.

## Чего не делаем
- Веб-админку вне Telegram.
- Перевод старых ботов (из @BotFather) под управление Zumda.
