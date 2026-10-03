# Запуск: ваши задачи

Эти шаги можете сделать только вы: нужны ваши аккаунты и карта.
Всё остальное подготовлю я. Время: примерно 20–30 минут.

**Главное правило:** токены и ключи не присылайте в чат. Их место — переменные облачного
окружения Claude (шаг 5) и секреты GitHub (шаг 6). Сейчас один токен Cloudflare используется и
Claude, и деплоем; перед подключением настоящих магазинов все ключи перевыпустим.

---

## Шаг 1. Аккаунт Cloudflare ✅

- [x] Аккаунт есть, домен `zumda.shop` подключён к Cloudflare (статус Active, 3 октября 2026).

**Проверка:** вы видите панель Cloudflare (Account Home).

## Шаг 2. Включить R2 (хранилище фото)

- [ ] В меню слева: **R2 Object Storage**.
- [ ] Нажмите **Purchase R2 Plan** / **Add R2** и привяжите карту.
  - Деньги не списываются: бесплатно 10 ГБ, нам хватит надолго.
  - Карта нужна Cloudflare как защита от злоупотреблений.
- [ ] Бакет создавать **не нужно**: его создам я.

**Проверка:** страница R2 открывается без просьбы привязать карту.

## Шаг 3. API-токен Cloudflare

Один токен: им Claude настраивает Cloudflare через API, им же деплой из GitHub загружает код.

- [ ] Справа вверху: иконка профиля → **My Profile** → **API Tokens** → **Create Token** →
      **Create Custom Token** → **Get started**.
- [ ] Имя: `zumda-setup`.
- [ ] **Permissions** (кнопка **+ Add more** для каждой строки):

| Тип | Что | Доступ |
|---|---|---|
| Account | Workers Scripts | Edit |
| Account | D1 | Edit |
| Account | Workers R2 Storage | Edit |
| Account | Cloudflare Pages | Edit |
| Account | Account Settings | Read |
| Account | Workers Tail | Read |
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Zone | Workers Routes | Edit |
| Zone | Zone Settings | Edit |
| Zone | SSL and Certificates | Edit |

- [ ] **Account Resources:** Include → ваш аккаунт. **Zone Resources:** Include → Specific zone →
      `zumda.shop`.
- [ ] **Continue to summary** → **Create Token**. Скопируйте токен: его показывают **один раз**.
- [ ] **Account ID:** меню слева **Workers & Pages** → справа **Account ID** (32 символа).

**Проверка:** в списке API Tokens новый токен со статусом Active.

## Шаг 4. Боты Zumda

Боты уже созданы: `@zumdashop_bot` (подключение магазинов, витрина, команды админа) и
`@zumdashop_kuryer_bot` (доставщики). Нужны их токены и ваш Telegram ID.

- [ ] @BotFather → `/mybots` → `@zumdashop_bot` → **API Token** → скопируйте.
- [ ] То же для `@zumdashop_kuryer_bot`.
- [ ] Ваш Telegram ID: напишите **@userinfobot**, он ответит числом.
- [ ] Старого бота с прежним названием удалите: @BotFather → `/deletebot` (его токен когда-то
      попал в чат).

Аватары, описания, кнопки меню и вебхуки ботов Zumda настроит Claude и деплой.

## Шаг 5. Доступ для Claude (3 минуты)

- [ ] В Claude: меню облачного окружения в заголовке сессии → **Edit** → переменные окружения.
      По одной на строку, имена точно так:

```
CLOUDFLARE_API_TOKEN=…        токен из шага 3
CLOUDFLARE_ACCOUNT_ID=…       Account ID из шага 3
PLATFORM_BOT_TOKEN=…          токен @zumdashop_bot
COURIER_BOT_TOKEN=…           токен @zumdashop_kuryer_bot
PLATFORM_ADMIN_IDS=…          ваш Telegram ID; несколько админов — через запятую
```

- [ ] Сохраните. Переменные видит только **новая** сессия: откройте её и напишите
      «проверь доступы».

Claude запустит `scripts/check-access.sh`: он проверяет токен, аккаунт, зону `zumda.shop`, SSL, R2,
D1, Pages, Workers и обоих ботов и пишет `OK` / `FAIL` с подсказкой. Значения ключей он не
показывает.

## Шаг 6. GitHub (10 минут)

Эти настройки Claude через API недоступны (среда не пускает к настройкам Actions), поэтому их
делаете вы.

- [ ] **Окружение деплоя:** **Settings → Environments → New environment** → `production`.
  - **Deployment branches and tags** → **Selected branches and tags** → правило `main`.
  - **Environment secrets** → **Add environment secret** — те же 5 имён и значений, что в шаге 5.
  - Так ключи получает только деплой из `main`, а не pull request и не форки.
- [ ] **Settings → Actions → General:**
  - **Fork pull request workflows from outside collaborators** → **Require approval for all
    external contributors**.
  - **Workflow permissions** → **Read repository contents and packages permissions**; снимите
    галочку **Allow GitHub Actions to create and approve pull requests**.
- [ ] **Settings → Advanced Security** (в старом интерфейсе **Code security**): включите
      **Secret scanning** (Secret Protection) и **Push protection**.
- [ ] **Settings → Rules → Rulesets → New ruleset → New branch ruleset**: имя `main`,
      Enforcement **Active**, Target **Include default branch**, правила:
      **Restrict deletions**, **Block force pushes**, **Require a pull request before merging**
      (0 одобрений), **Require status checks to pass** → `quality-gates` и `e2e`.
      **Bypass list** → Repository admin (вы).
- [ ] Удалите старые секреты от прошлого проекта, если они есть: `SSH_HOST`, `SSH_USER`,
      `SSH_PRIVATE_KEY`, `DISCORD_WEBHOOK`.

**Проверка:** в окружении `production` 5 секретов (значения GitHub не показывает, это нормально).

**Ключ шифрования `TOKEN_ENC_KEY`** пока не нужен: первый деплой создаст его сам. Перед
подключением настоящих магазинов сделаем сохранённую копию (`SECURITY.md`, «Encryption key»):
пока магазинов нет, ключ можно заменить без потерь.

Дальше Claude:
1. проверит доступы (`scripts/check-access.sh`) и включит в Cloudflare Full (strict) и Always HTTPS;
2. поставит аватары и описания ботов Zumda через Telegram API (`brand/`);
3. запустит деплой (пуш в `main` → CI → деплой) и проверит прод: подключение магазина → заказ →
   статусы → уведомления. Новый адрес `workers.dev` иногда включается дольше 5 минут: тогда
   первый запуск остановится с понятной ошибкой, и Claude запустит его снова;
4. подключит свои адреса `app.zumda.shop` и `api.zumda.shop` (отдельный PR);
5. задаст район сети доставки командой в боте Zumda, например
   `/district Guliston 40.4897,68.7842 30`, и пришлёт ссылку на бота и инструкцию для магазинов
   (`docs/owner-guide.md`).

## Шаг 7. Три друга подключают магазины

Каждый друг делает это сам, со своего телефона (примерно 15 минут):

- [ ] **Еда, вода, продукты:** каждый создаёт своего бота в @BotFather и подключает магазин
      через бота Zumda (инструкция, раздел 1). На шаге 3 он вписывает **карту для оплаты**:
      клиенты платят только переводом на неё, до начала работы над заказом. Вы одобряете заявку
      кнопкой в чате бота Zumda.
- [ ] Каждый заполняет каталог: минимум 5 товаров с фото.
  - Вода: включить **Возврат бутылей и залог**, указать залог, отметить бутыль 19 л как возвратную.
  - Продукты: весовые товары в **кг** с шагом продажи.
- [ ] Каждый приглашает своих доставщиков: **Мой магазин → Настройки → Доставщики → «Пригласить доставщика»**
      и отправляет ссылку доставщику.
- [ ] Пробный заказ в каждом магазине: вы — клиент, друг — владелец, его доставщик — доставка.
      Переведите небольшую сумму на карту магазина и нажмите «Я перевёл».

**Проверка:** в каждом магазине пробный заказ прошёл путь «Новый → Я перевёл → Деньги пришли —
принять → … → Доставлен», клиент получил сообщения, доставщик нажал «Забрал» и «Доставил».

## Шаг 8. Витрина Zumda (когда договоритесь с магазином)

- [ ] Договоритесь с владельцем о проценте комиссии с продаж через витрину.
- [ ] В чате с ботом Zumda (вы админ) отправьте: `/market <адрес-магазина> <процент>`,
      например `/market osh-markaz 5`. Адрес магазина есть в карточке заявки в боте Zumda: после `@бота`, например `osh-markaz`.
- [ ] Бот ответит «в витрине, комиссия 5%», владелец получит сообщение.
- [ ] Убрать из витрины: `/market osh-markaz off`.

**Проверка:** в боте Zumda кнопка «Магазины и товары» → поиск находит товары магазина.

---

## Если что-то не получается

| Проблема | Что делать |
|---|---|
| Cloudflare не принимает карту | Попробуйте другую карту (Visa/Mastercard). Напишите мне, найдём обход |
| Нет нужной строки в Permissions | Пришлите скриншот экрана Permissions (без токена) |
| `scripts/check-access.sh` пишет `FAIL` | В строке есть подсказка; исправьте и откройте новую сессию |
| Потеряли токен Cloudflare | Удалите старый (Roll / Delete) и создайте новый по шагу 3 |
| Потеряли токен бота | В @BotFather: `/mybots` → ваш бот → **API Token** |
| Бот Zumda пишет «🚨 Ошибка на сервере Zumda» | Перешлите это сообщение мне. Ключей в нём нет |
| Бот магазина не подключился после одобрения | Бот Zumda пришлёт причину. Когда исправите, отправьте ему `/reconnect <адрес-магазина>` |
| Деплой остановился: «The Worker lost TOKEN_ENC_KEY» | Добавьте сохранённый ключ в секрет `TOKEN_ENC_KEY` и запустите деплой снова |

## Раз в неделю: копия базы (5 минут)

База сама хранит изменения за 7 дней. Для более старых копий раз в неделю на своём компьютере
выполните команды из `SECURITY.md`, раздел «Backups and restore». Файл копии содержит телефоны
клиентов: храните его только у себя, в зашифрованном архиве.
