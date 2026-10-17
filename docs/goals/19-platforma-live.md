# Цель 19. Zumda | Platforma в проде

**Статус:** ⛔ ждёт владельца · **ROADMAP:** M5 · **Зависит от:** 18

## Зачем
Код цели 18 готов. Чтобы «Platforma» заработала в новом боте, нужны шаги, которые делает только
владелец: бот в @BotFather, секрет в GitHub и настройки, которых нет в Bot API.

**Важно:** пока нет секрета `ADMIN_BOT_TOKEN`, деплой из `main` пропускается целиком («Deploy
skipped»). Прод остаётся как был до цели 18: «Platforma» в Zumda | Business, прежний Worker. Новые
слияния в прод тоже не попадут, пока секрета нет.

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
- [ ] Бот создан, секрет `ADMIN_BOT_TOKEN` в окружении `production`
- [ ] Деплой прошёл: в логе шаг «Admin bot», `platform.zumda.shop` отвечает 200,
      `scripts/check-access.sh` пишет OK для `ADMIN_BOT_TOKEN`
- [ ] Каждый админ нажал Start в новом боте
- [ ] Login Widget: Trusted Origin и Redirect URI для `platform.zumda.shop`
- [ ] Проверка на проде:
  - новая заявка пришла в новый бот и одобрена кнопкой;
  - оповещение об ошибке пришло из нового бота;
  - «Platforma» открывается из бота и из браузера;
  - в Zumda | Business «Platforma» больше нет
