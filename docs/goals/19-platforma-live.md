# Цель 19. Zumda | Platforma в проде

**Статус:** 🔨 в проде с 7 ноября 2026; осталось увидеть первую заявку и первое оповещение из
нового бота · **ROADMAP:** M5 · **Зависит от:** 18

## Зачем
Код цели 18 готов. Чтобы «Platforma» заработала в новом боте, нужны шаги, которые делает только
владелец: бот в @BotFather, секрет в GitHub и настройки, которых нет в Bot API.

**Сделано 7 ноября 2026:** владелец создал бота и добавил секрет, деплой 42403478322 (запуск
вручную) прошёл с шагом «Admin bot». С этого деплоя на проде также исправление зависаний (PR #87)
и категории и возраст для игрушек (PR #88).

## Что сделать (владелец)
1. @BotFather → `/newbot`. Имя любое: деплой поставит «Zumda | Platforma». Username на ваш
   выбор, например `zumdashop_platforma_bot`.
2. GitHub → Settings → Environments → `production` → секрет `ADMIN_BOT_TOKEN` с токеном бота.
   Тот же токен добавьте в переменные окружения Claude.
3. Дайте знать Claude: он запустит деплой событием `deploy` и проверит лог.
4. Каждый админ один раз нажимает **Start** в новом боте.
5. Для входа с компьютера: @BotFather → бот → Bot Settings → **Login Widget**:
   - Trusted Origin `https://platform.zumda.shop`;
   - Redirect URI `https://platform.zumda.shop/`.

Подробно: `docs/launch-checklist.md`, шаг 4.

## Definition of done
- [x] Бот создан, секрет `ADMIN_BOT_TOKEN` в окружении `production`
- [x] Деплой прошёл: в логе шаг «Admin bot» (getMe, вебхук, кнопка меню, имя, аватар),
      `platform.zumda.shop` отвечает 200, `/api/admin-web/login` отдаёт Client ID нового бота.
      `scripts/check-access.sh` у Claude не запускался: токенов ботов в его окружении нет;
      токен проверил сам деплой (getMe)
- [x] Каждый админ нажал Start в новом боте
- [x] Login Widget: Trusted Origin и Redirect URI для `platform.zumda.shop`
- [ ] Проверка на проде:
  - [ ] новая заявка пришла в новый бот и одобрена кнопкой;
  - [ ] оповещение об ошибке пришло из нового бота;
  - [x] «Platforma» открывается из бота и из браузера (владелец, 7 ноября 2026);
  - [x] в Zumda | Business «Platforma» больше нет
