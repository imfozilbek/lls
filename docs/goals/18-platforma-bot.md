# Цель 18. «Platforma» в своём боте: Zumda | Platforma

**Статус:** ✅ DoD выполнен (16 октября 2026, код в PR #84) · **ROADMAP:** M5 · **Зависит от:** 14, 15
· **Запуск в проде:** [цель 19](19-platforma-live.md)

## Решение владельца (16 октября 2026)
«Platforma», раздел админов, уходит из Zumda | Business в свой бот и свою Mini App. Zumda |
Business остаётся только для владельцев. Админы те же: `PLATFORM_ADMIN_IDS`.

## Зачем
Владелец и админы платформы получали всё в одном чате с бизнесами:
- заявки, оповещения об ошибках и «сеть не взяла заказ» в Zumda | Business;
- «Platforma» строкой в «Mening bizneslarim».

Свой бот разводит роли: владелец бизнеса видит только свои бизнесы, а работа платформы идёт в
отдельном месте со своим адресом.

## Что сделано
1. **Worker.**
   - `X-Bot: admin` проверяется токеном `ADMIN_BOT_TOKEN`. Роль `admin`, магазина нет: с
     `X-Shop` ответ 400 `ADMIN_NO_SHOP`.
   - `/api/admin/*` пускает только эту роль и только админа платформы. Zumda | Business
     «Platforma» больше не открывает, `/api/platform/me` удалён.
   - `GET /api/admin/me`: проверка доступа при открытии, без чтения D1.
   - Вебхук `/tg/admin`:
     - на `/start` админ получает «Platforma»;
     - любой другой человек получает строку со ссылками на Zumda | Shop и Zumda | Business;
     - кнопки `r:` на карточках одобряют заявку.
   - `/tg/business` по-прежнему отвечает на кнопки старых карточек.
   - Все сообщения админам идут через `telegram/admins.ts`: заявки, оповещения, поздние заказы
     сети, новый владелец бота, «бот не подключился».
   - Пока админ не нажал Start в новом боте, то же сообщение идёт из Zumda | Business. В нём
     напоминание нажать Start и ссылка на бот; кнопки `r:` остаются.
   - Вход из браузера: у каждого бота свой Client ID и своя сессия (`/api/admin-web/*`,
     `ADMIN_SESSION_SECRET`).
   - CORS: четвёртый адрес `ADMIN_APP_ORIGIN`.
2. **Приложение.**
   - `?mode=admin` и адрес `platform.` открывают «Platforma» первым экраном, без «назад».
   - Тот, кто не админ, видит один экран «Bu bo'lim faqat Zumda jamoasi uchun».
   - В браузере свой вход через Telegram.
   - В «Mening bizneslarim» строки «Platforma» нет. Старая кнопка там говорит, где «Platforma»
     теперь.
3. **Деплой и CI.**
   - Адрес `platform.zumda.shop`: Pages, DNS, CORS R2, smoke test.
   - Из `ADMIN_BOT_TOKEN` выводятся секреты вебхука и сессии.
   - `connect_admin_bot` ставит вебхук, кнопку меню «Platforma», имя «Zumda | Platforma»,
     описания, `/start` и аватар (знак со щитом).
   - Секрет обязателен для деплоя и проверяется в `scripts/check-access.sh`.
4. **Документы.**
   - CLAUDE.md: четыре бота.
   - `docs/launch-checklist.md`, SECURITY, ROADMAP, CHANGELOG, `docs/e2e.md`.

## Definition of done
- [x] Вход `X-Bot: admin`, охрана `/api/admin/*`; Business больше не открывает «Platforma»
- [x] Все сообщения админам приходят из нового бота; без Start в нём идёт запасной путь через
      Zumda | Business, кнопки одобрения работают в обоих
- [x] «Platforma» как своя Mini App; экран для не админа; вход из браузера со своей сессией
- [x] «Mening bizneslarim» без «Platforma»; старая кнопка говорит, где она теперь
- [x] Деплой, CI и `check-access.sh` знают новый бот и адрес; аватар в `brand/`
- [x] Тесты: core 311, app 144, worker 262; полный e2e 178/178, новые сценарии для нового бота
- [x] CLAUDE.md, чек-лист запуска, SECURITY, ROADMAP, CHANGELOG
- [x] Операционный запуск вынесен в [цель 19](19-platforma-live.md)
